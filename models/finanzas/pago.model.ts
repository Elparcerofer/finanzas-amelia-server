import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface PagoFila extends RowDataPacket {
  id: number;
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

export async function listarPagosPorDeuda(deudaId: number): Promise<PagoFila[]> {
  const [rows] = await pool.query<PagoFila[]>('SELECT * FROM pagos WHERE deuda_id = ? ORDER BY fecha_pago DESC', [deudaId]);
  return rows;
}

export async function obtenerPagoPorId(id: number): Promise<PagoFila | null> {
  const [rows] = await pool.query<PagoFila[]>('SELECT * FROM pagos WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function crearPago(pago: Pago): Promise<PagoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO pagos (deuda_id, monto, fecha_pago, metodo_pago, comprobante) VALUES (?, ?, ?, ?, ?)',
    [pago.deuda_id, pago.monto, pago.fecha_pago, pago.metodo_pago, pago.comprobante || null],
  );
  return (await obtenerPagoPorId(result.insertId)) as PagoFila;
}

export async function eliminarPago(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM pagos WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
