import { RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

/** Fila de marcas_tarjeta o categorias_tarjeta (misma forma). */
export interface ItemCatalogoTarjetaFila extends RowDataPacket {
  id: number;
  codigo: string;
  nombre: string;
}

export async function listarMarcasTarjeta(): Promise<ItemCatalogoTarjetaFila[]> {
  const [rows] = await pool.query<ItemCatalogoTarjetaFila[]>(
    'SELECT id, codigo, nombre FROM marcas_tarjeta WHERE activo = 1 ORDER BY orden, nombre',
  );
  return rows;
}

export async function listarCategoriasTarjeta(): Promise<ItemCatalogoTarjetaFila[]> {
  const [rows] = await pool.query<ItemCatalogoTarjetaFila[]>(
    'SELECT id, codigo, nombre FROM categorias_tarjeta WHERE activo = 1 ORDER BY orden, nombre',
  );
  return rows;
}

export async function marcaPorId(id: number): Promise<ItemCatalogoTarjetaFila | null> {
  const [rows] = await pool.query<ItemCatalogoTarjetaFila[]>(
    'SELECT id, codigo, nombre FROM marcas_tarjeta WHERE id = ? AND activo = 1', [id]);
  return rows[0] || null;
}

export async function marcaPorCodigo(codigo: string): Promise<ItemCatalogoTarjetaFila | null> {
  const [rows] = await pool.query<ItemCatalogoTarjetaFila[]>(
    'SELECT id, codigo, nombre FROM marcas_tarjeta WHERE codigo = ? AND activo = 1', [codigo]);
  return rows[0] || null;
}

export async function categoriaTarjetaPorId(id: number): Promise<ItemCatalogoTarjetaFila | null> {
  const [rows] = await pool.query<ItemCatalogoTarjetaFila[]>(
    'SELECT id, codigo, nombre FROM categorias_tarjeta WHERE id = ? AND activo = 1', [id]);
  return rows[0] || null;
}
