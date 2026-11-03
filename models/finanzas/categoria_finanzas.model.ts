import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface CategoriaFinanzasFila extends RowDataPacket {
  id: number;
  nombre: string;
  grupo: string | null;
  subtipo: string | null;
  emoji: string | null;
  color: string | null;
  notas: string | null;
}

export interface CategoriaFinanzasInput {
  nombre: string;
  grupo?: string | null;
  tipo?: string | null;
  emoji?: string | null;
  color?: string | null;
  notas?: string | null;
}

const SELECT_COLUMNAS = 'id, nombre, grupo, subtipo, emoji, color, notas';

export async function listarCategorias(): Promise<CategoriaFinanzasFila[]> {
  const [rows] = await pool.query<CategoriaFinanzasFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE tipo = 'categoria' AND activo = 1 ORDER BY nombre`,
  );
  return rows;
}

export async function obtenerCategoriaPorId(id: number): Promise<CategoriaFinanzasFila | null> {
  const [rows] = await pool.query<CategoriaFinanzasFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE id = ? AND tipo = 'categoria'`,
    [id],
  );
  return rows[0] || null;
}

export async function crearCategoria(datos: CategoriaFinanzasInput): Promise<CategoriaFinanzasFila> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO catalogos (tipo, nombre, grupo, subtipo, emoji, color, notas, activo) VALUES ('categoria', ?, ?, ?, ?, ?, ?, 1)",
    [datos.nombre, datos.grupo || null, datos.tipo || null, datos.emoji || null, datos.color || null, datos.notas || null],
  );
  return (await obtenerCategoriaPorId(result.insertId)) as CategoriaFinanzasFila;
}

export async function actualizarCategoria(id: number, datos: CategoriaFinanzasInput): Promise<CategoriaFinanzasFila | null> {
  await pool.query(
    `UPDATE catalogos SET
       nombre = COALESCE(?, nombre),
       grupo = ?,
       subtipo = ?,
       emoji = ?,
       color = ?,
       notas = ?
     WHERE id = ? AND tipo = 'categoria'`,
    [datos.nombre, datos.grupo || null, datos.tipo || null, datos.emoji || null, datos.color || null, datos.notas || null, id],
  );
  return obtenerCategoriaPorId(id);
}

export async function eliminarCategoria(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE catalogos SET activo = 0 WHERE id = ? AND tipo = 'categoria'",
    [id],
  );
  return result.affectedRows > 0;
}
