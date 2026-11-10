import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

/**
 * Lecturas para el motor de obligaciones: todas las deudas del usuario
 * con su detalle (tabla, consumos, tarjeta, acreedor) y sus pagos, en
 * pocas consultas (sin N+1). Ver services/finanzas/cartera.service.ts.
 */

export interface DeudaCarteraFila extends RowDataPacket {
  id: number;
  tipo_deuda: string;
  alias: string | null;
  acreedor_id: number | null;
  acreedor_nombre: string | null;
  acreedor_subtipo: string | null;
  acreedor_web: string | null;
  acreedor_logo: string | null;
  tarjeta_credito_id: number | null;
  categoria_id: number | null;
  paga_con: string | null;
  aviso_dias: number;
  monto_total: string;
  saldo_pendiente: string;
  tasa_interes: string | null;
  fecha_vencimiento: string;
  resumen_minimo: string | null;
  resumen_saldo: string | null;
  resumen_restantes_cuotas: number | null;
  creado_en: string;
}

export interface TarjetaCarteraFila extends RowDataPacket {
  id: number;
  nombre: string;
  entidad_id: number;
  emisor: string | null;
  emisor_web: string | null;
  emisor_logo: string | null;
  ultimos4: string | null;
  cupo: string;
  dia_corte: number | null;
  dia_pago: number | null;
  tasa_anual_pct: string | null;
  color: string | null;
  marca: string | null;
  propiedad: string | null;
}

export interface TablaCarteraFila extends RowDataPacket {
  id: number;
  deuda_id: number;
  tasa_anual_pct: string;
  fecha_inicio: string;
  seg_desgravamen_tipo: string;
  seg_desgravamen_valor: string;
  otros_seguros: string;
}

export interface CuotaCarteraFila extends RowDataPacket {
  tabla_amortizacion_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: string;
  interes: string;
  seguro: string;
  total_cuota: string;
  saldo_despues: string;
}

export interface ConsumoCarteraFila extends RowDataPacket {
  id: number;
  deuda_id: number;
  fecha_consumo: string;
  comercio: string;
  categoria_id: number | null;
  categoria_nombre: string | null;
  monto: string;
  tipo_consumo: 'corriente' | 'diferido';
  con_intereses: number;
  plazo_meses: number;
  meses_gracia: number;
}

export interface PagoCarteraFila extends RowDataPacket {
  id: number;
  deuda_id: number;
  accion: string;
  clave: string | null;
  modo_abono: string | null;
  descripcion: string | null;
  monto: string;
  fecha_pago: string;
  fecha_vence: string | null;
  metodo_pago: string;
  comprobante: string | null;
  parte_capital: string;
  parte_interes: string;
  parte_seguro: string;
  parte_recargos: string;
  saldo_antes: string | null;
  saldo_despues: string | null;
  total_antes: string | null;
  total_despues: string | null;
  origen_cuenta_id: number | null;
  origen_tarjeta_id: number | null;
  origen_agencia: string | null;
  origen_tercero: string | null;
  origen_relacion: string | null;
}

export interface Cartera {
  deudas: DeudaCarteraFila[];
  tarjetas: TarjetaCarteraFila[];
  tablas: TablaCarteraFila[];
  cuotas: CuotaCarteraFila[];
  consumos: ConsumoCarteraFila[];
  pagos: PagoCarteraFila[];
  pagosCategorias: { pago_id: number; categoria_id: number; monto: string }[];
  pagosCargos: { pago_id: number; tipo: string; monto: string }[];
}

const vacio = <T>(ids: number[], f: () => Promise<T[]>): Promise<T[]> => (ids.length ? f() : Promise.resolve([]));

export async function leerCartera(usuarioId: number, soloDeudaId?: number): Promise<Cartera> {
  const filtro = soloDeudaId ? 'AND d.id = ?' : '';
  const params = soloDeudaId ? [usuarioId, soloDeudaId] : [usuarioId];

  const [deudas] = await pool.query<DeudaCarteraFila[]>(
    `SELECT d.id, d.tipo_deuda, d.alias, d.acreedor_id, a.nombre AS acreedor_nombre, a.subtipo AS acreedor_subtipo,
            a.web AS acreedor_web, a.logo AS acreedor_logo,
            d.tarjeta_credito_id, d.categoria_id, d.paga_con, d.aviso_dias, d.monto_total, d.saldo_pendiente,
            d.tasa_interes, d.fecha_vencimiento, d.resumen_minimo, d.resumen_saldo, d.resumen_restantes_cuotas,
            DATE_FORMAT(d.creado_en, '%Y-%m-%d') AS creado_en
     FROM deudas d LEFT JOIN catalogos a ON a.id = d.acreedor_id
     WHERE d.usuario_id = ? ${filtro}
     ORDER BY d.id`,
    params,
  );
  const ids = deudas.map((d) => d.id);
  const idsTarjeta = [...new Set(deudas.map((d) => d.tarjeta_credito_id).filter((x): x is number => !!x))];

  const [tarjetas, tablas, consumos, pagos] = await Promise.all([
    vacio(idsTarjeta, async () => {
      const [r] = await pool.query<TarjetaCarteraFila[]>(
        `SELECT t.id, t.nombre, t.entidad_id, e.nombre AS emisor, e.web AS emisor_web, e.logo AS emisor_logo, t.ultimos4, t.cupo, t.dia_corte, t.dia_pago,
                t.tasa_anual_pct, t.color, COALESCE(m.nombre, t.marca) AS marca, t.propiedad
         FROM tarjetas_credito t
         LEFT JOIN catalogos e ON e.id = t.entidad_id
         LEFT JOIN marcas_tarjeta m ON m.id = t.marca_id
         WHERE t.id IN (?) AND t.usuario_id = ?`,
        [idsTarjeta, usuarioId],
      );
      return r;
    }),
    vacio(ids, async () => {
      const [r] = await pool.query<TablaCarteraFila[]>(
        `SELECT t.id, t.deuda_id, t.tasa_anual_pct, t.fecha_inicio, t.seg_desgravamen_tipo,
                t.seg_desgravamen_valor, t.otros_seguros
         FROM tablas_amortizacion t
         WHERE t.deuda_id IN (?) AND t.es_vigente = 1
           AND t.version = (SELECT MAX(x.version) FROM tablas_amortizacion x WHERE x.deuda_id = t.deuda_id AND x.es_vigente = 1)`,
        [ids],
      );
      return r;
    }),
    vacio(ids, async () => {
      const [r] = await pool.query<ConsumoCarteraFila[]>(
        `SELECT ct.id, ct.deuda_id, ct.fecha_consumo, ct.comercio, ct.categoria_id, c.nombre AS categoria_nombre,
                ct.monto, ct.tipo_consumo, ct.con_intereses, ct.plazo_meses, ct.meses_gracia
         FROM consumos_tarjeta ct LEFT JOIN categorias c ON c.id = ct.categoria_id
         WHERE ct.deuda_id IN (?) ORDER BY ct.fecha_consumo, ct.id`,
        [ids],
      );
      return r;
    }),
    vacio(ids, async () => {
      const [r] = await pool.query<PagoCarteraFila[]>(
        `SELECT id, deuda_id, accion, clave, modo_abono, descripcion, monto, fecha_pago, fecha_vence, metodo_pago,
                comprobante, parte_capital, parte_interes, parte_seguro, parte_recargos,
                saldo_antes, saldo_despues, total_antes, total_despues,
                origen_cuenta_id, origen_tarjeta_id, origen_agencia, origen_tercero, origen_relacion
         FROM pagos
         WHERE usuario_id = ? AND deuda_id IN (?) AND estado = 'registrado'
         ORDER BY id`,
        [usuarioId, ids],
      );
      return r;
    }),
  ]);

  const idsTabla = tablas.map((t) => t.id);
  const idsPago = pagos.map((p) => p.id);
  const [cuotas, pagosCategorias, pagosCargos] = await Promise.all([
    vacio(idsTabla, async () => {
      const [r] = await pool.query<CuotaCarteraFila[]>(
        `SELECT tabla_amortizacion_id, numero_cuota, fecha_vencimiento, capital, interes, seguro, total_cuota, saldo_despues
         FROM cuotas_amortizacion WHERE tabla_amortizacion_id IN (?) ORDER BY tabla_amortizacion_id, numero_cuota`,
        [idsTabla],
      );
      return r;
    }),
    vacio(idsPago, async () => {
      const [r] = await pool.query<RowDataPacket[]>(
        'SELECT pago_id, categoria_id, monto FROM pagos_categorias WHERE pago_id IN (?)',
        [idsPago],
      );
      return r as Cartera['pagosCategorias'];
    }),
    vacio(idsPago, async () => {
      const [r] = await pool.query<RowDataPacket[]>('SELECT pago_id, tipo, monto FROM pagos_cargos WHERE pago_id IN (?)', [
        idsPago,
      ]);
      return r as Cartera['pagosCargos'];
    }),
  ]);

  return { deudas, tarjetas, tablas, cuotas, consumos, pagos, pagosCategorias, pagosCargos };
}

/* ------------------------------------------------------------- escritura */

export interface NuevoPagoDb {
  deudaId: number;
  accion: string;
  clave: string | null;
  modoAbono: string | null;
  descripcion: string;
  monto: number;
  fechaPago: string;
  fechaVence: string | null;
  metodoPago: string;
  comprobante: string | null;
  parteCapital: number;
  parteInteres: number;
  parteSeguro: number;
  parteRecargos: number;
  saldoAntes: number;
  saldoDespues: number;
  totalAntes: number;
  totalDespues: number;
  origenCuentaId: number | null;
  origenTarjetaId: number | null;
  origenAgencia: string | null;
  origenTercero: string | null;
  origenRelacion: string | null;
  categorias: [number, number][];
  cargos: [string, number][];
  /** Estado y saldo de la deuda después del pago (columnas de resumen). */
  estadoDeuda: string;
  saldoDeuda: number;
}

/** Inserta el pago con sus categorías y cargos, y actualiza el resumen de la deuda. Todo o nada. */
export async function insertarPago(usuarioId: number, p: NuevoPagoDb): Promise<number> {
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [res] = await cx.query<ResultSetHeader>(
      `INSERT INTO pagos
         (usuario_id, deuda_id, accion, clave, modo_abono, descripcion, monto, fecha_pago, fecha_vence, metodo_pago,
          comprobante, parte_capital, parte_interes, parte_seguro, parte_recargos,
          saldo_antes, saldo_despues, total_antes, total_despues,
          origen_cuenta_id, origen_tarjeta_id, origen_agencia, origen_tercero, origen_relacion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registrado')`,
      [
        usuarioId, p.deudaId, p.accion, p.clave, p.modoAbono, p.descripcion, p.monto, p.fechaPago, p.fechaVence,
        p.metodoPago, p.comprobante, p.parteCapital, p.parteInteres, p.parteSeguro, p.parteRecargos,
        p.saldoAntes, p.saldoDespues, p.totalAntes, p.totalDespues,
        p.origenCuentaId, p.origenTarjetaId, p.origenAgencia, p.origenTercero, p.origenRelacion,
      ],
    );
    const pagoId = res.insertId;
    if (p.categorias.length) {
      await cx.query('INSERT INTO pagos_categorias (pago_id, categoria_id, monto) VALUES ?', [
        p.categorias.map(([c, m]) => [pagoId, c, m]),
      ]);
    }
    if (p.cargos.length) {
      await cx.query('INSERT INTO pagos_cargos (pago_id, tipo, monto) VALUES ?', [p.cargos.map(([t, m]) => [pagoId, t, m])]);
    }
    await cx.query('UPDATE deudas SET estado = ?, saldo_pendiente = ? WHERE id = ? AND usuario_id = ?', [
      p.estadoDeuda, p.saldoDeuda, p.deudaId, usuarioId,
    ]);
    await cx.commit();
    return pagoId;
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}

/** Id del último pago vigente de la deuda (solo ese se puede anular). */
export async function ultimoPagoVigente(usuarioId: number, deudaId: number): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM pagos WHERE usuario_id = ? AND deuda_id = ? AND estado = 'registrado' ORDER BY id DESC LIMIT 1",
    [usuarioId, deudaId],
  );
  return rows.length ? Number(rows[0].id) : null;
}

export async function deudaDelPago(usuarioId: number, pagoId: number): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT deuda_id FROM pagos WHERE id = ? AND usuario_id = ? AND estado = 'registrado'",
    [pagoId, usuarioId],
  );
  return rows.length ? Number(rows[0].deuda_id) : null;
}

export async function marcarPagoAnulado(
  usuarioId: number,
  pagoId: number,
  motivo: string | null,
  deudaId: number,
  estadoDeuda: string,
  saldoDeuda: number,
): Promise<void> {
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    await cx.query(
      "UPDATE pagos SET estado = 'anulado', anulado_en = CURRENT_TIMESTAMP, motivo_anulacion = ? WHERE id = ? AND usuario_id = ?",
      [motivo, pagoId, usuarioId],
    );
    await cx.query('UPDATE deudas SET estado = ?, saldo_pendiente = ? WHERE id = ? AND usuario_id = ?', [
      estadoDeuda, saldoDeuda, deudaId, usuarioId,
    ]);
    await cx.commit();
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}

/** true si la cuenta / tarjeta / categoría existe y es del usuario. */
export async function cuentaEsDelUsuario(usuarioId: number, id: number): Promise<boolean> {
  const [r] = await pool.query<RowDataPacket[]>('SELECT id FROM cuentas WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return r.length > 0;
}

export async function tarjetaEsDelUsuario(usuarioId: number, id: number): Promise<boolean> {
  const [r] = await pool.query<RowDataPacket[]>('SELECT id FROM tarjetas_credito WHERE id = ? AND usuario_id = ?', [
    id,
    usuarioId,
  ]);
  return r.length > 0;
}
