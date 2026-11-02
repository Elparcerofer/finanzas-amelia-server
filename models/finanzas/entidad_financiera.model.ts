import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export const TIPOS_ENTIDAD = ['banco', 'bancoPublico', 'cooperativa', 'mutualista', 'bancoExterior', 'fintech'];

export interface EntidadFinancieraFila extends RowDataPacket {
  id: number;
  nombre: string;
  tipo: string;
  pais: string | null;
  telefono: string | null;
  notas: string | null;
}

export interface EntidadFinancieraInput {
  nombre: string;
  tipo?: string | null;
  pais?: string | null;
  telefono?: string | null;
  notas?: string | null;
}

/**
 * catalogos.tipo tiene un CHECK que solo permite 'banco'/'empresa'/'categoria'
 * (constraint real del backend, no se toca). El subtipo fino de
 * TipoEntidadFinanciera (bancoPublico/cooperativa/mutualista/bancoExterior/
 * fintech) se guarda en `subtipo`, y se expone como `tipo` hacia Flutter.
 */
const SELECT_COLUMNAS = 'id, nombre, subtipo AS tipo, pais, telefono, notas';

export async function listarEntidades(): Promise<EntidadFinancieraFila[]> {
  const [rows] = await pool.query<EntidadFinancieraFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE tipo = 'banco' AND activo = 1 ORDER BY nombre`,
  );
  return rows;
}

export async function obtenerEntidadPorId(id: number): Promise<EntidadFinancieraFila | null> {
  const [rows] = await pool.query<EntidadFinancieraFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE id = ? AND tipo = 'banco'`,
    [id],
  );
  return rows[0] || null;
}

export async function crearEntidad(datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO catalogos (tipo, nombre, subtipo, pais, telefono, notas, activo) VALUES ('banco', ?, ?, ?, ?, ?, 1)",
    [datos.nombre, datos.tipo || 'banco', datos.pais || 'Ecuador', datos.telefono || null, datos.notas || null],
  );
  return (await obtenerEntidadPorId(result.insertId)) as EntidadFinancieraFila;
}

export async function actualizarEntidad(id: number, datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila | null> {
  await pool.query(
    `UPDATE catalogos SET
       nombre = COALESCE(?, nombre),
       subtipo = COALESCE(?, subtipo),
       pais = ?,
       telefono = ?,
       notas = ?
     WHERE id = ? AND tipo = 'banco'`,
    [datos.nombre, datos.tipo, datos.pais || 'Ecuador', datos.telefono || null, datos.notas || null, id],
  );
  return obtenerEntidadPorId(id);
}

export async function eliminarEntidad(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE catalogos SET activo = 0 WHERE id = ? AND tipo = 'banco'",
    [id],
  );
  return result.affectedRows > 0;
}
