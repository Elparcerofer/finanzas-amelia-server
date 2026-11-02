import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface IngresoFila extends RowDataPacket {
  id: number;
  usuario_id: number;
  monto: string;
  fuente: string;
  fecha: string;
  periodicidad: 'mensual' | 'quincenal' | 'semanal' | 'unico';
}

export interface Ingreso {
  id?: number;
  usuario_id: number;
  monto: number;
  fuente: string;
  fecha: Date | string;
  periodicidad: 'mensual' | 'quincenal' | 'semanal' | 'unico';
}

export async function listarIngresosPorUsuario(usuarioId: number): Promise<IngresoFila[]> {
  const [rows] = await pool.query<IngresoFila[]>('SELECT * FROM ingresos WHERE usuario_id = ? ORDER BY fecha DESC', [usuarioId]);
  return rows;
}

export async function obtenerIngresoPorId(id: number): Promise<IngresoFila | null> {
  const [rows] = await pool.query<IngresoFila[]>('SELECT * FROM ingresos WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function crearIngreso(ingreso: Ingreso): Promise<IngresoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO ingresos (usuario_id, monto, fuente, fecha, periodicidad) VALUES (?, ?, ?, ?, ?)',
    [ingreso.usuario_id, ingreso.monto, ingreso.fuente, ingreso.fecha, ingreso.periodicidad],
  );
  return (await obtenerIngresoPorId(result.insertId)) as IngresoFila;
}

export async function actualizarIngreso(id: number, ingreso: Partial<Ingreso>): Promise<IngresoFila | null> {
  await pool.query(
    `UPDATE ingresos SET
       monto = COALESCE(?, monto),
       fuente = COALESCE(?, fuente),
       fecha = COALESCE(?, fecha),
       periodicidad = COALESCE(?, periodicidad)
     WHERE id = ?`,
    [ingreso.monto, ingreso.fuente, ingreso.fecha, ingreso.periodicidad, id],
  );
  return obtenerIngresoPorId(id);
}

export async function eliminarIngreso(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM ingresos WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function sumaIngresosMensualesPorUsuario(usuarioId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM ingresos
     WHERE usuario_id = ? AND periodicidad = 'mensual'`,
    [usuarioId],
  );
  return Number(rows[0].total);
}
