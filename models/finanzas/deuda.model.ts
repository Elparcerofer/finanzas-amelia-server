import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface DeudaFila extends RowDataPacket {
  id: number;
  catalogo_id: number | null;
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

const SELECT_DEUDA = `id, catalogo_id, tarjeta_credito_id, descripcion, monto_total, saldo_pendiente, tasa_interes,
  fecha_inicio, fecha_vencimiento, estado, tipo_deuda, alias, aviso_dias, categoria_id,
  resumen_minimo, resumen_corte, resumen_restantes_cuotas`;

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
            seg_desgravamen_tipo, seg_desgravamen_valor, otros_seguros
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

export interface DatosDeudaDb {
  catalogoId: number | null;
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
): Promise<number> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [resultDeuda] = await conexion.query<ResultSetHeader>(
      `INSERT INTO deudas
         (usuario_id, catalogo_id, tarjeta_credito_id, descripcion, monto_total, saldo_pendiente, tasa_interes,
          fecha_inicio, fecha_vencimiento, estado, tipo_deuda, alias, aviso_dias, categoria_id,
          resumen_minimo, resumen_corte, resumen_restantes_cuotas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        deuda.catalogoId,
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
      ],
    );
    const deudaId = resultDeuda.insertId;

    if (tabla) {
      await insertarTablaYCuotas(conexion, deudaId, tabla, cuotas);
    }

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
): Promise<void> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    await conexion.query(
      `UPDATE deudas SET
         catalogo_id = ?, tarjeta_credito_id = ?, descripcion = ?, monto_total = ?, saldo_pendiente = ?,
         tasa_interes = ?, fecha_inicio = ?, fecha_vencimiento = ?, tipo_deuda = ?, alias = ?, aviso_dias = ?,
         categoria_id = ?, resumen_minimo = ?, resumen_corte = ?, resumen_restantes_cuotas = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        deuda.catalogoId,
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
        id,
        usuarioId,
      ],
    );

    // Reemplaza por completo la tabla de amortización vigente (el PUT de
    // Flutter manda el objeto Deuda entero cada vez, no un parche).
    await conexion.query('DELETE FROM tablas_amortizacion WHERE deuda_id = ?', [id]);

    if (tabla) {
      await insertarTablaYCuotas(conexion, id, tabla, cuotas);
    }

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
        es_vigente, seg_desgravamen_tipo, seg_desgravamen_valor, otros_seguros)
     VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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

export async function eliminarDeudaCompleta(usuarioId: number, id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM deudas WHERE id = ? AND usuario_id = ?',
    [id, usuarioId],
  );
  return result.affectedRows > 0;
}
