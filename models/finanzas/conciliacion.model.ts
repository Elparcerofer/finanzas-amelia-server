import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

/**
 * Consumos de una deuda de tarjeta detallada (alta / baja individual) y
 * conciliación de cada período con el estado de cuenta.
 */

export interface ConciliacionFila extends RowDataPacket {
  id: number;
  periodo: string;
  valor_estado: string | null;
  pago_real: string | null;
  fecha_pago: string | null;
  pdf_nombre: string | null;
  pdf_montos: number[] | string | null;
  pdf_sugeridos: { etiqueta: string; valor: number }[] | string | null;
}

const json = <T>(v: T | string | null): T | null => (typeof v === 'string' ? (JSON.parse(v) as T) : v);

export interface Conciliacion {
  id: number | null;
  periodo: string;
  valorEstado: number | null;
  pagoReal: number | null;
  fechaPago: string | null;
  pdfNombre: string | null;
  montos: number[];
  sugeridos: { etiqueta: string; valor: number }[];
  conciliados: string[];
}

export async function leerConciliacion(deudaId: number, periodo: string): Promise<Conciliacion> {
  const [rows] = await pool.query<ConciliacionFila[]>(
    `SELECT id, periodo, valor_estado, pago_real, fecha_pago, pdf_nombre, pdf_montos, pdf_sugeridos
     FROM conciliaciones_tarjeta WHERE deuda_id = ? AND periodo = ?`,
    [deudaId, periodo],
  );
  const c = rows[0];
  if (!c) {
    return { id: null, periodo, valorEstado: null, pagoReal: null, fechaPago: null, pdfNombre: null, montos: [], sugeridos: [], conciliados: [] };
  }
  const [items] = await pool.query<RowDataPacket[]>('SELECT item_clave FROM conciliaciones_items WHERE conciliacion_id = ?', [c.id]);
  return {
    id: c.id,
    periodo,
    valorEstado: c.valor_estado != null ? Number(c.valor_estado) : null,
    pagoReal: c.pago_real != null ? Number(c.pago_real) : null,
    fechaPago: c.fecha_pago,
    pdfNombre: c.pdf_nombre,
    montos: json<number[]>(c.pdf_montos) || [],
    sugeridos: json<{ etiqueta: string; valor: number }[]>(c.pdf_sugeridos) || [],
    conciliados: items.map((i) => String(i.item_clave)),
  };
}

/** Id de la conciliación del período (la crea vacía si no existe). */
async function asegurar(usuarioId: number, deudaId: number, periodo: string): Promise<number> {
  const [r] = await pool.query<ResultSetHeader>(
    `INSERT INTO conciliaciones_tarjeta (usuario_id, deuda_id, periodo) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [usuarioId, deudaId, periodo],
  );
  return r.insertId;
}

export async function guardarValores(
  usuarioId: number,
  deudaId: number,
  periodo: string,
  v: { valorEstado: number | null; pagoReal: number | null; fechaPago: string | null },
): Promise<void> {
  const id = await asegurar(usuarioId, deudaId, periodo);
  await pool.query('UPDATE conciliaciones_tarjeta SET valor_estado = ?, pago_real = ?, fecha_pago = ? WHERE id = ?', [
    v.valorEstado,
    v.pagoReal,
    v.fechaPago,
    id,
  ]);
}

export async function guardarPdf(
  usuarioId: number,
  deudaId: number,
  periodo: string,
  nombre: string,
  montos: number[],
  sugeridos: { etiqueta: string; valor: number }[],
): Promise<void> {
  const id = await asegurar(usuarioId, deudaId, periodo);
  // Si aún no hay valor del estado de cuenta, se usa el primer sugerido (total a pagar).
  await pool.query(
    `UPDATE conciliaciones_tarjeta
     SET pdf_nombre = ?, pdf_montos = ?, pdf_sugeridos = ?, valor_estado = COALESCE(valor_estado, ?)
     WHERE id = ?`,
    [nombre, JSON.stringify(montos), JSON.stringify(sugeridos), sugeridos[0]?.valor ?? null, id],
  );
}

export async function marcarItems(
  usuarioId: number,
  deudaId: number,
  periodo: string,
  claves: string[],
  conciliado: boolean,
): Promise<void> {
  if (!claves.length) return;
  const id = await asegurar(usuarioId, deudaId, periodo);
  if (conciliado) {
    await pool.query('INSERT IGNORE INTO conciliaciones_items (conciliacion_id, item_clave) VALUES ?', [claves.map((k) => [id, k])]);
  } else {
    await pool.query('DELETE FROM conciliaciones_items WHERE conciliacion_id = ? AND item_clave IN (?)', [id, claves]);
  }
}

/* ------------------------------------------------- consumos de tarjeta */

export interface NuevoConsumo {
  fecha: string;
  comercio: string;
  categoriaId: number;
  monto: number;
  tipoConsumo: 'corriente' | 'diferido';
  conIntereses: boolean;
  plazo: number;
  mesesGracia: number;
}

/** Recalcula monto_total y fecha_inicio de la deuda con sus consumos. */
async function recalcularTotales(deudaId: number): Promise<void> {
  await pool.query(
    `UPDATE deudas d
     JOIN (SELECT deuda_id, SUM(monto) AS total, MIN(fecha_consumo) AS inicio FROM consumos_tarjeta WHERE deuda_id = ? GROUP BY deuda_id) c
       ON c.deuda_id = d.id
     SET d.monto_total = c.total, d.fecha_inicio = c.inicio`,
    [deudaId],
  );
}

export async function insertarConsumo(deudaId: number, c: NuevoConsumo): Promise<number> {
  const [r] = await pool.query<ResultSetHeader>(
    `INSERT INTO consumos_tarjeta
       (deuda_id, fecha_consumo, comercio, categoria_id, monto, tipo_consumo, con_intereses, plazo_meses, meses_gracia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [deudaId, c.fecha, c.comercio, c.categoriaId, c.monto, c.tipoConsumo, c.conIntereses ? 1 : 0, c.plazo, c.mesesGracia],
  );
  await recalcularTotales(deudaId);
  return r.insertId;
}

export async function contarConsumos(deudaId: number): Promise<number> {
  const [r] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM consumos_tarjeta WHERE deuda_id = ?', [deudaId]);
  return Number(r[0].n);
}

export async function eliminarConsumo(deudaId: number, consumoId: number): Promise<boolean> {
  const [r] = await pool.query<ResultSetHeader>('DELETE FROM consumos_tarjeta WHERE id = ? AND deuda_id = ?', [consumoId, deudaId]);
  if (r.affectedRows) await recalcularTotales(deudaId);
  return r.affectedRows > 0;
}
