import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';
import { normalizarWeb, paraActualizar } from '../../utils/finanzas/logo_web';

export const TIPOS_ENTIDAD = ['banco', 'bancoPublico', 'cooperativa', 'mutualista', 'bancoExterior', 'fintech'];

export interface EntidadFinancieraFila extends RowDataPacket {
  id: number;
  nombre: string;
  tipo: string;
  codigo: string | null;
  ruc: string | null;
  /** Organismo de control (Superintendencia de Bancos / SEPS) — columna `grupo`. */
  regulador: string | null;
  activo: number;
  pais: string | null;
  telefono: string | null;
  web: string | null;
  logo: string | null;
  notas: string | null;
}

export interface EntidadFinancieraInput {
  nombre: string;
  tipo?: string | null;
  codigo?: string | null;
  ruc?: string | null;
  pais?: string | null;
  telefono?: string | null;
  web?: string | null;
  logo?: string | null;
  notas?: string | null;
}

/**
 * catalogos.tipo tiene un CHECK que solo permite 'banco'/'empresa'/'categoria'
 * (constraint real del backend, no se toca). El subtipo fino de
 * TipoEntidadFinanciera (bancoPublico/cooperativa/mutualista/bancoExterior/
 * fintech) se guarda en `subtipo`, y se expone como `tipo` hacia Flutter.
 */
const SELECT_COLUMNAS =
  'id, nombre, subtipo AS tipo, codigo, ruc, grupo AS regulador, activo, pais, telefono, web, logo, notas';

/** Organismo de control según el subtipo (ver seed entidades_financieras). */
export function reguladorDe(subtipo: string | null | undefined): string | null {
  switch (subtipo) {
    case 'banco':
    case 'bancoPublico':
      return 'Superintendencia de Bancos';
    case 'cooperativa':
    case 'mutualista':
      return 'Superintendencia de Economía Popular y Solidaria (SEPS)';
    default:
      return null;
  }
}

/**
 * Otra entidad activa o inactiva con el mismo nombre o código — la
 * collation utf8mb4_unicode_ci compara sin mayúsculas ni tildes.
 * [excluirId] para no chocar consigo misma al editar.
 */
export async function buscarDuplicado(
  nombre: string,
  codigo: string | null | undefined,
  excluirId?: number,
): Promise<EntidadFinancieraFila | null> {
  const [rows] = await pool.query<EntidadFinancieraFila[]>(
    `SELECT ${SELECT_COLUMNAS} FROM catalogos
     WHERE tipo = 'banco' AND (nombre = ? OR (? IS NOT NULL AND codigo = ?)) AND id <> ?
     LIMIT 1`,
    [nombre, codigo || null, codigo || null, excluirId || 0],
  );
  return rows[0] || null;
}

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
    `INSERT INTO catalogos (tipo, nombre, subtipo, codigo, ruc, grupo, pais, telefono, web, logo, notas, activo)
     VALUES ('banco', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      datos.nombre,
      datos.tipo || 'banco',
      datos.codigo || null,
      datos.ruc || null,
      reguladorDe(datos.tipo || 'banco'),
      datos.pais || 'Ecuador',
      datos.telefono || null,
      normalizarWeb(datos.web),
      datos.logo || null,
      datos.notas || null,
    ],
  );
  return (await obtenerEntidadPorId(result.insertId)) as EntidadFinancieraFila;
}

export async function actualizarEntidad(id: number, datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila | null> {
  await pool.query(
    `UPDATE catalogos SET
       nombre = COALESCE(?, nombre),
       subtipo = COALESCE(?, subtipo),
       grupo = COALESCE(?, grupo),
       codigo = ?,
       ruc = ?,
       pais = ?,
       telefono = ?,
       web = CASE WHEN ? THEN ? ELSE web END,
       logo = CASE WHEN ? THEN ? ELSE logo END,
       notas = ?
     WHERE id = ? AND tipo = 'banco'`,
    [
      datos.nombre,
      datos.tipo,
      reguladorDe(datos.tipo),
      datos.codigo || null,
      datos.ruc || null,
      datos.pais || 'Ecuador',
      datos.telefono || null,
      ...paraActualizar(datos.web, normalizarWeb),
      ...paraActualizar(datos.logo),
      datos.notas || null,
      id,
    ],
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
