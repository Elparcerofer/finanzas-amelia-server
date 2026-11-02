import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface ConsumoFila extends RowDataPacket {
  id: number;
  usuario_id: number;
  categoria_id: number;
  monto: string;
  fecha: string;
  descripcion: string | null;
}

export interface Consumo {
  id?: number;
  usuario_id: number;
  categoria_id: number;
  monto: number;
  fecha: Date | string;
  descripcion?: string;
}

export async function listarConsumosPorUsuario(usuarioId: number): Promise<ConsumoFila[]> {
  const [rows] = await pool.query<ConsumoFila[]>('SELECT * FROM consumos WHERE usuario_id = ? ORDER BY fecha DESC', [usuarioId]);
  return rows;
}

export async function obtenerConsumoPorId(id: number): Promise<ConsumoFila | null> {
  const [rows] = await pool.query<ConsumoFila[]>('SELECT * FROM consumos WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function crearConsumo(consumo: Consumo): Promise<ConsumoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO consumos (usuario_id, categoria_id, monto, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
    [consumo.usuario_id, consumo.categoria_id, consumo.monto, consumo.fecha, consumo.descripcion || null],
  );
  return (await obtenerConsumoPorId(result.insertId)) as ConsumoFila;
}

export async function eliminarConsumo(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM consumos WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function resumenConsumosPorCategoria(usuarioId: number): Promise<{ categoria_id: number; total: number }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT categoria_id, SUM(monto) AS total FROM consumos WHERE usuario_id = ? GROUP BY categoria_id',
    [usuarioId],
  );
  return rows.map((r) => ({ categoria_id: r.categoria_id, total: Number(r.total) }));
}
