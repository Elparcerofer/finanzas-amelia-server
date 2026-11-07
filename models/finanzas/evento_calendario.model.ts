import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface EventoCalendarioFila extends RowDataPacket {
  id: number;
  usuario_id: number;
  titulo: string;
  fecha: string;
  tipo: 'pago' | 'ingreso' | 'recordatorio';
  /** Tabla a la que apunta referencia_id (ej. 'deuda', 'ingreso', 'pago'). */
  referencia_tipo: string | null;
  referencia_id: number | null;
}

export interface EventoCalendario {
  id?: number;
  usuario_id: number;
  titulo: string;
  fecha: Date | string;
  tipo: 'pago' | 'ingreso' | 'recordatorio';
  referencia_tipo?: string;
  referencia_id?: number;
}

export async function listarEventosPorUsuario(usuarioId: number, desde?: string, hasta?: string): Promise<EventoCalendarioFila[]> {
  if (desde && hasta) {
    const [rows] = await pool.query<EventoCalendarioFila[]>(
      'SELECT * FROM eventos_calendario WHERE usuario_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha ASC',
      [usuarioId, desde, hasta],
    );
    return rows;
  }
  const [rows] = await pool.query<EventoCalendarioFila[]>('SELECT * FROM eventos_calendario WHERE usuario_id = ? ORDER BY fecha ASC', [usuarioId]);
  return rows;
}

export async function crearEventoCalendario(evento: EventoCalendario): Promise<EventoCalendarioFila> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO eventos_calendario (usuario_id, titulo, fecha, tipo, referencia_tipo, referencia_id) VALUES (?, ?, ?, ?, ?, ?)',
    [evento.usuario_id, evento.titulo, evento.fecha, evento.tipo, evento.referencia_tipo || null, evento.referencia_id || null],
  );
  const [rows] = await pool.query<EventoCalendarioFila[]>('SELECT * FROM eventos_calendario WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function eliminarEventoCalendario(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM eventos_calendario WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
