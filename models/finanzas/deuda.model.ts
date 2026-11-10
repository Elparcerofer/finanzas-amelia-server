import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface DeudaFila extends RowDataPacket {
  id: number;
  acreedor_id: number | null;
  tarjeta_credito_id: number | null;
  descripcion: string | null;
  monto_total: string;
  saldo_pendiente: string;
  tasa_interes: string | null;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: string;
  tipo_deuda: string;
  alias: string | null;
  aviso_dias: number;
  categoria_id: number | null;
  resumen_minimo: string | null;
  resumen_corte: string | null;
  resumen_restantes_cuotas: number | null;
  paga_con: string | null;
}

export interface TablaAmortizacionFila extends RowDataPacket {
  id: number;
  deuda_id: number;
  monto_financiado: string;
  tasa_anual_pct: string;
  plazo_meses: number;
  fecha_inicio: string;
  metodo_cuota: string;
  seg_desgravamen_tipo: string;
  seg_desgravamen_valor: string;
  otros_seguros: string;
  origen: string;
}

/** Consumo de una deuda de tarjeta en modo detallado (consumos_tarjeta). */
export interface ConsumoTarjetaFila extends RowDataPacket {
  id: number;
  fecha_consumo: string;
  comercio: string;
  categoria_id: number;
  categoria_nombre: string | null;
  monto: string;
  tipo_consumo: 'corriente' | 'diferido';
  con_intereses: number;
  plazo_meses: number;
  meses_gracia: number;
}

export interface CuotaAmortizacionFila extends RowDataPacket {
  id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: string;
  interes: string;
  seguro: string;
  total_cuota: string;
  saldo_despues: string;
}

const SELECT_DEUDA = `id, acreedor_id, tarjeta_credito_id, descripcion, monto_total, saldo_pendiente, tasa_interes,
  fecha_inicio, fecha_vencimiento, estado, tipo_deuda, alias, aviso_dias, categoria_id,
  resumen_minimo, resumen_corte, resumen_restantes_cuotas, paga_con`;

export async function listarDeudasFilas(usuarioId: number): Promise<DeudaFila[]> {
  const [rows] = await pool.query<DeudaFila[]>(
    `SELECT ${SELECT_DEUDA} FROM deudas WHERE usuario_id = ? ORDER BY fecha_vencimiento ASC`,
    [usuarioId],
  );
  return rows;
}

export async function obtenerDeudaFila(usuarioId: number, id: number): Promise<DeudaFila | null> {
  const [rows] = await pool.query<DeudaFila[]>(
    `SELECT ${SELECT_DEUDA} FROM deudas WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId],
  );
  return rows[0] || null;
}

export async function obtenerTablaVigente(deudaId: number): Promise<TablaAmortizacionFila | null> {
  const [rows] = await pool.query<TablaAmortizacionFila[]>(
    `SELECT id, deuda_id, monto_financiado, tasa_anual_pct, plazo_meses, fecha_inicio, metodo_cuota,
            seg_desgravamen_tipo, seg_desgravamen_valor, otros_seguros, origen
     FROM tablas_amortizacion WHERE deuda_id = ? AND es_vigente = 1 ORDER BY version DESC LIMIT 1`,
    [deudaId],
  );
  return rows[0] || null;
}

export async function obtenerCuotas(tablaAmortizacionId: number): Promise<CuotaAmortizacionFila[]> {
  const [rows] = await pool.query<CuotaAmortizacionFila[]>(
    `SELECT id, numero_cuota, fecha_vencimiento, capital, interes, seguro, total_cuota, saldo_despues
     FROM cuotas_amortizacion WHERE tabla_amortizacion_id = ? ORDER BY numero_cuota ASC`,
    [tablaAmortizacionId],
  );
  return rows;
}

export async function obtenerConsumosTarjeta(deudaId: number): Promise<ConsumoTarjetaFila[]> {
  const [rows] = await pool.query<ConsumoTarjetaFila[]>(
    `SELECT ct.id, ct.fecha_consumo, ct.comercio, ct.categoria_id, c.nombre AS categoria_nombre,
            ct.monto, ct.tipo_consumo, ct.con_intereses, ct.plazo_meses, ct.meses_gracia
     FROM consumos_tarjeta ct
     LEFT JOIN categorias c ON c.id = ct.categoria_id
     WHERE ct.deuda_id = ? ORDER BY ct.fecha_consumo ASC, ct.id ASC`,
    [deudaId],
  );
  return rows;
}

/**
 * Día de pago de la tarjeta (para calcular el vencimiento de una deuda
 * de tarjeta registrada por consumos). undefined = la tarjeta no existe
 * o no es del usuario; null = existe pero no tiene día de pago.
 */
export async function diaPagoTarjeta(usuarioId: number, tarjetaId: number): Promise<number | null | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT dia_pago FROM tarjetas_credito WHERE id = ? AND usuario_id = ?',
    [tarjetaId, usuarioId],
  );
  if (!rows.length) return undefined;
  return rows[0].dia_pago ?? null;
}

/**
 * "¿Con qué se paga?": c:<cuenta del usuario> · t:<tarjeta del usuario> ·
 * e:<entidad activa>. true si la referencia existe y es del usuario.
 */
export async function pagaConValido(usuarioId: number, ref: string): Promise<boolean> {
  const m = /^([cte]):(\d+)$/.exec(ref);
  if (!m) return false;
  const id = Number(m[2]);
  const sql = {
    c: 'SELECT id FROM cuentas WHERE id = ? AND usuario_id = ?',
    t: 'SELECT id FROM tarjetas_credito WHERE id = ? AND usuario_id = ? AND activa = 1',
    e: "SELECT id FROM catalogos WHERE id = ? AND tipo = 'banco' AND activo = 1 AND ? IS NOT NULL",
  }[m[1] as 'c' | 't' | 'e'];
  const [rows] = await pool.query<RowDataPacket[]>(sql, [id, usuarioId]);
  return rows.length > 0;
}

/** De los ids recibidos, los que son categorías existentes. */
export async function categoriasExistentes(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM categorias WHERE id IN (?)',
    [ids],
  );
  return new Set(rows.map((r) => Number(r.id)));
}

export interface DatosDeudaDb {
  acreedorId: number | null;
  tarjetaCreditoId: number | null;
  descripcion: string | null;
  tipoDeuda: string;
  alias: string | null;
  avisoDias: number;
  categoriaId: number | null;
  montoTotal: number;
  saldoPendiente: number;
  tasaInteres: number | null;
  fechaInicio: string;
  fechaVencimiento: string;
  resumenMinimo: number | null;
  resumenCorte: string | null;
  resumenRestantesCuotas: number | null;
  pagaCon: string | null;
}

export interface DatosTablaAmortizacionDb {
  montoFinanciado: number;
  tasaAnualPct: number;
  plazoMeses: number;
  fechaInicio: string;
  metodoCuota: string;
  segDesgravamenTipo: string;
  segDesgravamenValor: number;
  otrosSeguros: number;
  origen: 'generada' | 'subida';
}

export interface DatosConsumoDb {
  fecha: string;
  comercio: string;
  categoriaId: number;
  monto: number;
  tipoConsumo: 'corriente' | 'diferido';
  conIntereses: boolean;
  plazo: number;
  mesesGracia: number;
}

export interface DatosCuotaDb {
  numero: number;
  fecha: string;
  capital: number;
  interes: number;
  seguro: number;
  cuota: number;
  saldo: number;
}

export async function insertarDeudaCompleta(
  usuarioId: number,
  deuda: DatosDeudaDb,
  tabla: DatosTablaAmortizacionDb | null,
  cuotas: DatosCuotaDb[],
  consumos: DatosConsumoDb[] = [],
): Promise<number> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [resultDeuda] = await conexion.query<ResultSetHeader>(
      `INSERT INTO deudas
         (usuario_id, acreedor_id, tarjeta_credito_id, descripcion, monto_total, saldo_pendiente, tasa_interes,
          fecha_inicio, fecha_vencimiento, estado, tipo_deuda, alias, aviso_dias, categoria_id,
          resumen_minimo, resumen_corte, resumen_restantes_cuotas, paga_con)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        deuda.acreedorId,
        deuda.tarjetaCreditoId,
        deuda.descripcion,
        deuda.montoTotal,
        deuda.saldoPendiente,
        deuda.tasaInteres,
        deuda.fechaInicio,
        deuda.fechaVencimiento,
        deuda.tipoDeuda,
        deuda.alias,
        deuda.avisoDias,
        deuda.categoriaId,
        deuda.resumenMinimo,
        deuda.resumenCorte,
        deuda.resumenRestantesCuotas,
        deuda.pagaCon,
      ],
    );
    const deudaId = resultDeuda.insertId;

    if (tabla) {
      await insertarTablaYCuotas(conexion, deudaId, tabla, cuotas);
    }
    await insertarConsumos(conexion, deudaId, consumos);

    await conexion.commit();
    return deudaId;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function actualizarDeudaCompleta(
  usuarioId: number,
  id: number,
  deuda: DatosDeudaDb,
  tabla: DatosTablaAmortizacionDb | null,
  cuotas: DatosCuotaDb[],
  consumos: DatosConsumoDb[] = [],
): Promise<void> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    await conexion.query(
      `UPDATE deudas SET
         acreedor_id = ?, tarjeta_credito_id = ?, descripcion = ?, monto_total = ?, saldo_pendiente = ?,
         tasa_interes = ?, fecha_inicio = ?, fecha_vencimiento = ?, tipo_deuda = ?, alias = ?, aviso_dias = ?,
         categoria_id = ?, resumen_minimo = ?, resumen_corte = ?, resumen_restantes_cuotas = ?, paga_con = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        deuda.acreedorId,
        deuda.tarjetaCreditoId,
        deuda.descripcion,
        deuda.montoTotal,
        deuda.saldoPendiente,
        deuda.tasaInteres,
        deuda.fechaInicio,
        deuda.fechaVencimiento,
        deuda.tipoDeuda,
        deuda.alias,
        deuda.avisoDias,
        deuda.categoriaId,
        deuda.resumenMinimo,
        deuda.resumenCorte,
        deuda.resumenRestantesCuotas,
        deuda.pagaCon,
        id,
        usuarioId,
      ],
    );

    // Reemplaza por completo la tabla de amortización vigente (el PUT de
    // Flutter manda el objeto Deuda entero cada vez, no un parche). Sin
    // ON DELETE CASCADE, las cuotas se borran antes que su tabla.
    await borrarDetalle(conexion, id);

    if (tabla) {
      await insertarTablaYCuotas(conexion, id, tabla, cuotas);
    }
    await insertarConsumos(conexion, id, consumos);

    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function insertarTablaYCuotas(
  conexion: Awaited<ReturnType<typeof pool.getConnection>>,
  deudaId: number,
  tabla: DatosTablaAmortizacionDb,
  cuotas: DatosCuotaDb[],
): Promise<void> {
  const [resultTabla] = await conexion.query<ResultSetHeader>(
    `INSERT INTO tablas_amortizacion
       (deuda_id, version, monto_financiado, tasa_anual_pct, plazo_meses, fecha_inicio, metodo_cuota,
        es_vigente, seg_desgravamen_tipo, seg_desgravamen_valor, otros_seguros, origen)
     VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      deudaId,
      tabla.montoFinanciado,
      tabla.tasaAnualPct,
      tabla.plazoMeses,
      tabla.fechaInicio,
      tabla.metodoCuota,
      tabla.segDesgravamenTipo,
      tabla.segDesgravamenValor,
      tabla.otrosSeguros,
      tabla.origen,
    ],
  );
  const tablaId = resultTabla.insertId;

  for (const cuota of cuotas) {
    await conexion.query(
      `INSERT INTO cuotas_amortizacion
         (tabla_amortizacion_id, numero_cuota, fecha_vencimiento, capital, interes, seguro, total_cuota, saldo_despues, liquidada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [tablaId, cuota.numero, cuota.fecha, cuota.capital, cuota.interes, cuota.seguro, cuota.cuota, cuota.saldo],
    );
  }
}

async function insertarConsumos(
  conexion: Awaited<ReturnType<typeof pool.getConnection>>,
  deudaId: number,
  consumos: DatosConsumoDb[],
): Promise<void> {
  if (!consumos.length) return;
  await conexion.query(
    `INSERT INTO consumos_tarjeta
       (deuda_id, fecha_consumo, comercio, categoria_id, monto, tipo_consumo, con_intereses, plazo_meses, meses_gracia)
     VALUES ?`,
    [consumos.map((c) => [
      deudaId, c.fecha, c.comercio, c.categoriaId, c.monto, c.tipoConsumo, c.conIntereses ? 1 : 0, c.plazo, c.mesesGracia,
    ])],
  );
}

type Conexion = Awaited<ReturnType<typeof pool.getConnection>>;

/** Tabla de amortización (con sus cuotas) y consumos de la deuda. */
async function borrarDetalle(conexion: Conexion, deudaId: number): Promise<void> {
  await conexion.query(
    `DELETE c FROM cuotas_amortizacion c
     JOIN tablas_amortizacion t ON t.id = c.tabla_amortizacion_id
     WHERE t.deuda_id = ?`,
    [deudaId],
  );
  await conexion.query('DELETE FROM tablas_amortizacion WHERE deuda_id = ?', [deudaId]);
  await conexion.query('DELETE FROM consumos_tarjeta WHERE deuda_id = ?', [deudaId]);
}

/**
 * Ya no hay ON DELETE CASCADE: el detalle propio de la deuda (tabla de
 * amortización, cuotas, consumos) se borra aquí explícitamente. Los pagos
 * no se borran nunca en silencio: si la deuda tiene pagos, no se elimina.
 */
export async function eliminarDeudaCompleta(
  usuarioId: number,
  id: number,
): Promise<'eliminada' | 'no_existe' | 'con_pagos'> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [deuda] = await conexion.query<RowDataPacket[]>(
      'SELECT id FROM deudas WHERE id = ? AND usuario_id = ? FOR UPDATE',
      [id, usuarioId],
    );
    if (!deuda.length) {
      await conexion.rollback();
      return 'no_existe';
    }

    const [pagos] = await conexion.query<RowDataPacket[]>('SELECT id FROM pagos WHERE deuda_id = ? LIMIT 1', [id]);
    if (pagos.length) {
      await conexion.rollback();
      return 'con_pagos';
    }

    await borrarDetalle(conexion, id);
    await conexion.query('DELETE FROM deudas WHERE id = ? AND usuario_id = ?', [id, usuarioId]);

    await conexion.commit();
    return 'eliminada';
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
