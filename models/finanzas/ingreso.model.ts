import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export type ClaseIngreso = 'fijo' | 'extra' | 'variable' | 'activo' | 'otro' | 'prestamo';

export interface FuenteIngresoFila extends RowDataPacket {
  codigo: string;
  nombre: string;
  clase: ClaseIngreso;
}

export interface IngresoFila extends RowDataPacket {
  id: number;
  fuente: string;
  fuente_nombre: string;
  clase: ClaseIngreso;
  descripcion: string | null;
  monto: string;
  fecha: string;
  periodicidad: 'mensual' | 'unico';
  hasta: string | null;
  cuenta_id: number | null;
}

export interface IngresoDb {
  fuente: string;
  descripcion: string | null;
  monto: number;
  fecha: string;
  periodicidad: 'mensual' | 'unico';
  hasta: string | null;
  cuentaId: number | null;
}

const SELECT = `SELECT i.id, i.fuente, f.nombre AS fuente_nombre, f.clase, i.descripcion, i.monto,
  i.fecha, i.periodicidad, i.hasta, i.cuenta_id
  FROM ingresos i JOIN fuentes_ingreso f ON f.codigo = i.fuente`;

export async function listarFuentes(): Promise<FuenteIngresoFila[]> {
  const [rows] = await pool.query<FuenteIngresoFila[]>(
    'SELECT codigo, nombre, clase FROM fuentes_ingreso WHERE activo = 1 ORDER BY orden, nombre',
  );
  return rows;
}

export async function fuenteExiste(codigo: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT codigo FROM fuentes_ingreso WHERE codigo = ? AND activo = 1', [
    codigo,
  ]);
  return rows.length > 0;
}

/** Todos los ingresos del usuario (más recientes primero). */
export async function listarIngresosPorUsuario(usuarioId: number): Promise<IngresoFila[]> {
  const [rows] = await pool.query<IngresoFila[]>(`${SELECT} WHERE i.usuario_id = ? ORDER BY i.fecha DESC, i.id DESC`, [
    usuarioId,
  ]);
  return rows;
}

export async function obtenerIngresoPorId(usuarioId: number, id: number): Promise<IngresoFila | null> {
  const [rows] = await pool.query<IngresoFila[]>(`${SELECT} WHERE i.id = ? AND i.usuario_id = ?`, [id, usuarioId]);
  return rows[0] || null;
}

export async function crearIngreso(usuarioId: number, i: IngresoDb): Promise<number> {
  const [r] = await pool.query<ResultSetHeader>(
    `INSERT INTO ingresos (usuario_id, fuente, descripcion, monto, fecha, periodicidad, hasta, cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuarioId, i.fuente, i.descripcion, i.monto, i.fecha, i.periodicidad, i.hasta, i.cuentaId],
  );
  return r.insertId;
}

export async function actualizarIngreso(usuarioId: number, id: number, i: IngresoDb): Promise<boolean> {
  const [r] = await pool.query<ResultSetHeader>(
    `UPDATE ingresos SET fuente = ?, descripcion = ?, monto = ?, fecha = ?, periodicidad = ?, hasta = ?, cuenta_id = ?
     WHERE id = ? AND usuario_id = ?`,
    [i.fuente, i.descripcion, i.monto, i.fecha, i.periodicidad, i.hasta, i.cuentaId, id, usuarioId],
  );
  return r.affectedRows > 0;
}

export async function eliminarIngreso(usuarioId: number, id: number): Promise<boolean> {
  const [r] = await pool.query<ResultSetHeader>('DELETE FROM ingresos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return r.affectedRows > 0;
}

/** Ingreso mensual estimado del perfil (respaldo si no hay ingresos fijos registrados). */
export async function ingresoDelPerfil(usuarioId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT ingreso_mensual_estimado FROM perfiles WHERE usuario_id = ?', [
    usuarioId,
  ]);
  return Number(rows[0]?.ingreso_mensual_estimado) || 0;
}
