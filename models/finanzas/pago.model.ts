import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface PagoFila extends RowDataPacket {
  id: number;
  usuario_id: number;
  deuda_id: number;
  monto: string;
  fecha_pago: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'debito_automatico';
  comprobante: string | null;
}

export interface Pago {
  id?: number;
  deuda_id: number;
  monto: number;
  fecha_pago: Date | string;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'debito_automatico';
  comprobante?: string;
}

export async function listarPagosPorDeuda(usuarioId: number, deudaId: number): Promise<PagoFila[]> {
  const [rows] = await pool.query<PagoFila[]>(
    'SELECT * FROM pagos WHERE deuda_id = ? AND usuario_id = ? ORDER BY fecha_pago DESC',
    [deudaId, usuarioId],
  );
  return rows;
}

export async function obtenerPagoPorId(usuarioId: number, id: number): Promise<PagoFila | null> {
  const [rows] = await pool.query<PagoFila[]>('SELECT * FROM pagos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return rows[0] || null;
}

/** true si la deuda existe y es del usuario. */
export async function deudaEsDelUsuario(usuarioId: number, deudaId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM deudas WHERE id = ? AND usuario_id = ?', [deudaId, usuarioId]);
  return rows.length > 0;
}

export async function crearPago(usuarioId: number, pago: Pago): Promise<PagoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO pagos (usuario_id, deuda_id, monto, fecha_pago, metodo_pago, comprobante) VALUES (?, ?, ?, ?, ?, ?)',
    [usuarioId, pago.deuda_id, pago.monto, pago.fecha_pago, pago.metodo_pago, pago.comprobante || null],
  );
  return (await obtenerPagoPorId(usuarioId, result.insertId)) as PagoFila;
}

export async function eliminarPago(usuarioId: number, id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM pagos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return result.affectedRows > 0;
}
