import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface PerfilFila extends RowDataPacket {
  id: number;
  usuario_id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string | null;
  ingreso_mensual_estimado: string | null;
}

export interface Perfil {
  id?: number;
  usuario_id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono?: string;
  ingreso_mensual_estimado?: number;
}

export async function obtenerPerfilPorUsuario(usuarioId: number): Promise<PerfilFila | null> {
  const [rows] = await pool.query<PerfilFila[]>('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
  return rows[0] || null;
}

export async function crearPerfil(perfil: Perfil): Promise<PerfilFila> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO perfiles (usuario_id, nombres, apellidos, cedula, telefono, ingreso_mensual_estimado)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [perfil.usuario_id, perfil.nombres, perfil.apellidos, perfil.cedula, perfil.telefono || null, perfil.ingreso_mensual_estimado || null],
  );
  return (await obtenerPerfilPorUsuario(perfil.usuario_id)) as PerfilFila;
}

export async function actualizarPerfil(usuarioId: number, perfil: Partial<Perfil>): Promise<PerfilFila | null> {
  await pool.query(
    `UPDATE perfiles SET
       nombres = COALESCE(?, nombres),
       apellidos = COALESCE(?, apellidos),
       telefono = ?,
       ingreso_mensual_estimado = ?
     WHERE usuario_id = ?`,
    [perfil.nombres, perfil.apellidos, perfil.telefono || null, perfil.ingreso_mensual_estimado || null, usuarioId],
  );
  return obtenerPerfilPorUsuario(usuarioId);
}
