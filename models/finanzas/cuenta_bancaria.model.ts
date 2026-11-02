import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface CuentaBancariaFila extends RowDataPacket {
  id: number;
  alias: string;
  tipo_cuenta: string;
  entidad_id: number | null;
  ultimos4: string | null;
  titular: string | null;
  propiedad: string;
  relacion: string | null;
  notas: string | null;
}

export interface CuentaBancariaInput {
  alias: string;
  tipoCuenta?: string | null;
  entidadId?: string | number | null;
  ultimos4?: string | null;
  titular?: string | null;
  propiedad?: string | null;
  relacion?: string | null;
  notas?: string | null;
}

const SELECT_COLUMNAS = 'id, alias, tipo_cuenta, entidad_id, ultimos4, titular, propiedad, relacion, notas';

export async function listarCuentas(usuarioId: number): Promise<CuentaBancariaFila[]> {
  const [rows] = await pool.query<CuentaBancariaFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM cuentas WHERE usuario_id = ? ORDER BY alias`,
    [usuarioId],
  );
  return rows;
}

export async function obtenerCuentaPorId(usuarioId: number, id: number): Promise<CuentaBancariaFila | null> {
  const [rows] = await pool.query<CuentaBancariaFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM cuentas WHERE id = ? AND usuario_id = ?`,
    [id, usuarioId],
  );
  return rows[0] || null;
}

export async function crearCuenta(usuarioId: number, datos: CuentaBancariaInput): Promise<CuentaBancariaFila> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO cuentas (usuario_id, alias, tipo_cuenta, entidad_id, ultimos4, titular, propiedad, relacion, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuarioId,
      datos.alias,
      datos.tipoCuenta || 'ahorros',
      datos.entidadId ? Number(datos.entidadId) : null,
      datos.ultimos4 || null,
      datos.titular || null,
      datos.propiedad || 'propia',
      datos.relacion || null,
      datos.notas || null,
    ],
  );
  return (await obtenerCuentaPorId(usuarioId, result.insertId)) as CuentaBancariaFila;
}

export async function actualizarCuenta(usuarioId: number, id: number, datos: CuentaBancariaInput): Promise<CuentaBancariaFila | null> {
  await pool.query(
    `UPDATE cuentas SET
       alias = COALESCE(?, alias),
       tipo_cuenta = COALESCE(?, tipo_cuenta),
       entidad_id = ?,
       ultimos4 = ?,
       titular = ?,
       propiedad = COALESCE(?, propiedad),
       relacion = ?,
       notas = ?
     WHERE id = ? AND usuario_id = ?`,
    [
      datos.alias,
      datos.tipoCuenta,
      datos.entidadId ? Number(datos.entidadId) : null,
      datos.ultimos4 || null,
      datos.titular || null,
      datos.propiedad,
      datos.relacion || null,
      datos.notas || null,
      id,
      usuarioId,
    ],
  );
  return obtenerCuentaPorId(usuarioId, id);
}

export async function eliminarCuenta(usuarioId: number, id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM cuentas WHERE id = ? AND usuario_id = ?',
    [id, usuarioId],
  );
  return result.affectedRows > 0;
}
