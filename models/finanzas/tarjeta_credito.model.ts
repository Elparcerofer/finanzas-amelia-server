import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface TarjetaCreditoFila extends RowDataPacket {
  id: number;
  catalogo_id: number;
  nombre: string;
  marca: string;
  ultimos4: string | null;
  cupo: string;
  dia_corte: number | null;
  dia_pago: number | null;
  tasa_anual_pct: string | null;
  titular: string | null;
  tipo_titular: string;
  vencimiento: string | null;
  uso: string;
  propiedad: string;
  prestada_por: string | null;
  notas: string | null;
}

export interface TarjetaCreditoInput {
  entidadId: string | number;
  alias: string;
  marca?: string | null;
  titular?: string | null;
  tipoTitular?: string | null;
  ultimos4?: string | null;
  vencimiento?: string | null;
  cupo?: number | null;
  uso?: string | null;
  propiedad?: string | null;
  prestadaPor?: string | null;
  corte?: number | null;
  diaPago?: number | null;
  tasaAnual?: number | null;
  notas?: string | null;
}

const SELECT_COLUMNAS = `id, catalogo_id, nombre, marca, ultimos4, cupo, dia_corte, dia_pago, tasa_anual_pct,
  titular, tipo_titular, vencimiento, uso, propiedad, prestada_por, notas`;

export async function listarTarjetas(usuarioId: number): Promise<TarjetaCreditoFila[]> {
  const [rows] = await pool.query<TarjetaCreditoFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM tarjetas_credito WHERE usuario_id = ? AND activa = 1 ORDER BY nombre`,
    [usuarioId],
  );
  return rows;
}

export async function obtenerTarjetaPorId(usuarioId: number, id: number): Promise<TarjetaCreditoFila | null> {
  const [rows] = await pool.query<TarjetaCreditoFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM tarjetas_credito WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId],
  );
  return rows[0] || null;
}

export async function crearTarjeta(usuarioId: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO tarjetas_credito
       (usuario_id, catalogo_id, nombre, marca, ultimos4, cupo, dia_corte, dia_pago, tasa_anual_pct,
        titular, tipo_titular, vencimiento, uso, propiedad, prestada_por, notas, color, activa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indigo', 1)`,
    [
      usuarioId,
      Number(datos.entidadId),
      datos.alias,
      datos.marca || 'visa',
      datos.ultimos4 || null,
      datos.cupo ?? 0,
      datos.corte ?? null,
      datos.diaPago ?? null,
      datos.tasaAnual ?? null,
      datos.titular || null,
      datos.tipoTitular || 'principal',
      datos.vencimiento || null,
      datos.uso || 'personal',
      datos.propiedad || 'propia',
      datos.prestadaPor || null,
      datos.notas || null,
    ],
  );
  return (await obtenerTarjetaPorId(usuarioId, result.insertId)) as TarjetaCreditoFila;
}

export async function actualizarTarjeta(usuarioId: number, id: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoFila | null> {
  await pool.query(
    `UPDATE tarjetas_credito SET
       catalogo_id = COALESCE(?, catalogo_id),
       nombre = COALESCE(?, nombre),
       marca = COALESCE(?, marca),
       ultimos4 = ?,
       cupo = COALESCE(?, cupo),
       dia_corte = ?,
       dia_pago = ?,
       tasa_anual_pct = ?,
       titular = ?,
       tipo_titular = COALESCE(?, tipo_titular),
       vencimiento = ?,
       uso = COALESCE(?, uso),
       propiedad = COALESCE(?, propiedad),
       prestada_por = ?,
       notas = ?
     WHERE id = ? AND usuario_id = ?`,
    [
      datos.entidadId ? Number(datos.entidadId) : null,
      datos.alias,
      datos.marca,
      datos.ultimos4 || null,
      datos.cupo,
      datos.corte ?? null,
      datos.diaPago ?? null,
      datos.tasaAnual ?? null,
      datos.titular || null,
      datos.tipoTitular,
      datos.vencimiento || null,
      datos.uso,
      datos.propiedad,
      datos.prestadaPor || null,
      datos.notas || null,
      id,
      usuarioId,
    ],
  );
  return obtenerTarjetaPorId(usuarioId, id);
}

export async function eliminarTarjeta(usuarioId: number, id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE tarjetas_credito SET activa = 0 WHERE id = ? AND usuario_id = ?',
    [id, usuarioId],
  );
  return result.affectedRows > 0;
}
