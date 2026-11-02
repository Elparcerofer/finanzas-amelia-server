import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface EmpresaCatalogoFila extends RowDataPacket {
  id: number;
  nombre: string;
  rubro: string | null;
  cobertura: string | null;
  telefono: string | null;
  notas: string | null;
}

export interface EmpresaCatalogoInput {
  nombre: string;
  rubro?: string | null;
  cobertura?: string | null;
  telefono?: string | null;
  notas?: string | null;
}

const SELECT_COLUMNAS = 'id, nombre, rubro, cobertura, telefono, notas';

export async function listarEmpresas(): Promise<EmpresaCatalogoFila[]> {
  const [rows] = await pool.query<EmpresaCatalogoFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE tipo = 'empresa' AND activo = 1 ORDER BY nombre`,
  );
  return rows;
}

export async function obtenerEmpresaPorId(id: number): Promise<EmpresaCatalogoFila | null> {
  const [rows] = await pool.query<EmpresaCatalogoFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos WHERE id = ? AND tipo = 'empresa'`,
    [id],
  );
  return rows[0] || null;
}

export async function crearEmpresa(datos: EmpresaCatalogoInput): Promise<EmpresaCatalogoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO catalogos (tipo, nombre, rubro, cobertura, telefono, notas, activo) VALUES ('empresa', ?, ?, ?, ?, ?, 1)",
    [datos.nombre, datos.rubro || null, datos.cobertura || null, datos.telefono || null, datos.notas || null],
  );
  return (await obtenerEmpresaPorId(result.insertId)) as EmpresaCatalogoFila;
}

export async function actualizarEmpresa(id: number, datos: EmpresaCatalogoInput): Promise<EmpresaCatalogoFila | null> {
  await pool.query(
    `UPDATE catalogos SET
       nombre = COALESCE(?, nombre),
       rubro = ?,
       cobertura = ?,
       telefono = ?,
       notas = ?
     WHERE id = ? AND tipo = 'empresa'`,
    [datos.nombre, datos.rubro || null, datos.cobertura || null, datos.telefono || null, datos.notas || null, id],
  );
  return obtenerEmpresaPorId(id);
}

export async function eliminarEmpresa(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE catalogos SET activo = 0 WHERE id = ? AND tipo = 'empresa'",
    [id],
  );
  return result.affectedRows > 0;
}
