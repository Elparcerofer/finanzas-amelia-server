import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface TarjetaCreditoFila extends RowDataPacket {
  id: number;
  catalogo_id: number;
  nombre: string;
  marca: string;
  marca_id: number | null;
  marca_nombre: string | null;
  categoria_tarjeta_id: number | null;
  categoria_tarjeta_nombre: string | null;
  ultimos4: string | null;
  cupo: string;
  dia_corte: number | null;
  dia_pago: number | null;
  tasa_anual_pct: string | null;
  titular: string | null;
  tipo_titular: string;
  vencimiento: string | null;
  uso: string;
  propiedad: string;
  prestada_por: string | null;
  costo_anual: string | null;
  callcenter: string | null;
  asesor: string | null;
  asesor_celular: string | null;
  cuenta_debito_id: number | null;
  color: string;
  notas: string | null;
}

/**
 * Lo que recibe el modelo ya resuelto por el servicio: `marcaId` y
 * `marcaCodigo` siempre vienen juntos (ver tarjetas.service resolverMarca).
 */
export interface TarjetaCreditoInput {
  entidadId: string | number;
  alias: string;
  marca?: string | null;
  marcaId?: number | null;
  marcaCodigo?: string | null;
  categoriaTarjetaId?: number | null;
  titular?: string | null;
  tipoTitular?: string | null;
  ultimos4?: string | null;
  vencimiento?: string | null;
  cupo?: number | null;
  uso?: string | null;
  propiedad?: string | null;
  prestadaPor?: string | null;
  corte?: number | null;
  diaPago?: number | null;
  tasaAnual?: number | null;
  costoAnual?: number | null;
  callcenter?: string | null;
  asesor?: string | null;
  asesorCelular?: string | null;
  cuentaDebitoId?: number | null;
  color?: string | null;
  notas?: string | null;
}

const SELECT_COLUMNAS = `t.id, t.catalogo_id, t.nombre, t.marca, t.marca_id, m.nombre AS marca_nombre,
  t.categoria_tarjeta_id, c.nombre AS categoria_tarjeta_nombre,
  t.ultimos4, t.cupo, t.dia_corte, t.dia_pago, t.tasa_anual_pct,
  t.titular, t.tipo_titular, t.vencimiento, t.uso, t.propiedad, t.prestada_por,
  t.costo_anual, t.callcenter, t.asesor, t.asesor_celular, t.cuenta_debito_id, t.color, t.notas`;

const FROM = `FROM tarjetas_credito t
  LEFT JOIN marcas_tarjeta m ON m.id = t.marca_id
  LEFT JOIN categorias_tarjeta c ON c.id = t.categoria_tarjeta_id`;

export async function listarTarjetas(usuarioId: number): Promise<TarjetaCreditoFila[]> {
  const [rows] = await pool.query<TarjetaCreditoFila[]>(
    `SELECT ${SELECT_COLUMNAS} ${FROM} WHERE t.usuario_id = ? AND t.activa = 1 ORDER BY t.nombre`,
    [usuarioId],
  );
  return rows;
}

export async function obtenerTarjetaPorId(usuarioId: number, id: number): Promise<TarjetaCreditoFila | null> {
  const [rows] = await pool.query<TarjetaCreditoFila[]>(
    `SELECT ${SELECT_COLUMNAS} ${FROM} WHERE t.id = ? AND t.usuario_id = ?`,
    [id, usuarioId],
  );
  return rows[0] || null;
}

/** true si la cuenta existe y es de este usuario (para el débito automático). */
export async function cuentaEsDelUsuario(usuarioId: number, cuentaId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM cuentas WHERE id = ? AND usuario_id = ?',
    [cuentaId, usuarioId],
  );
  return rows.length > 0;
}

/** Columnas que siempre se escriben tal cual (null = vacío). */
function valores(datos: TarjetaCreditoInput): unknown[] {
  return [
    datos.marcaCodigo,
    datos.marcaId ?? null,
    datos.categoriaTarjetaId ?? null,
    datos.ultimos4 || null,
    datos.corte ?? null,
    datos.diaPago ?? null,
    datos.tasaAnual ?? null,
    datos.titular || null,
    datos.vencimiento || null,
    datos.prestadaPor || null,
    datos.costoAnual ?? null,
    datos.callcenter || null,
    datos.asesor || null,
    datos.asesorCelular || null,
    datos.cuentaDebitoId ?? null,
    datos.notas || null,
  ];
}

export async function crearTarjeta(usuarioId: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoFila> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO tarjetas_credito
       (marca, marca_id, categoria_tarjeta_id, ultimos4, dia_corte, dia_pago, tasa_anual_pct,
        titular, vencimiento, prestada_por, costo_anual, callcenter, asesor, asesor_celular,
        cuenta_debito_id, notas,
        usuario_id, catalogo_id, nombre, cupo, tipo_titular, uso, propiedad, color, activa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      ...valores(datos),
      usuarioId,
      Number(datos.entidadId),
      datos.alias,
      datos.cupo ?? 0,
      datos.tipoTitular || 'principal',
      datos.uso || 'personal',
      datos.propiedad || 'propia',
      datos.color || 'indigo',
    ],
  );
  return (await obtenerTarjetaPorId(usuarioId, result.insertId)) as TarjetaCreditoFila;
}

export async function actualizarTarjeta(usuarioId: number, id: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoFila | null> {
  await pool.query(
    `UPDATE tarjetas_credito SET
       marca = ?, marca_id = ?, categoria_tarjeta_id = ?, ultimos4 = ?, dia_corte = ?, dia_pago = ?,
       tasa_anual_pct = ?, titular = ?, vencimiento = ?, prestada_por = ?, costo_anual = ?,
       callcenter = ?, asesor = ?, asesor_celular = ?, cuenta_debito_id = ?, notas = ?,
       catalogo_id = COALESCE(?, catalogo_id),
       nombre = COALESCE(?, nombre),
       cupo = COALESCE(?, cupo),
       tipo_titular = COALESCE(?, tipo_titular),
       uso = COALESCE(?, uso),
       propiedad = COALESCE(?, propiedad),
       color = COALESCE(?, color)
     WHERE id = ? AND usuario_id = ?`,
    [
      ...valores(datos),
      datos.entidadId ? Number(datos.entidadId) : null,
      datos.alias,
      datos.cupo,
      datos.tipoTitular,
      datos.uso,
      datos.propiedad,
      datos.color || null,
      id,
      usuarioId,
    ],
  );
  return obtenerTarjetaPorId(usuarioId, id);
}

export async function eliminarTarjeta(usuarioId: number, id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE tarjetas_credito SET activa = 0 WHERE id = ? AND usuario_id = ?',
    [id, usuarioId],
  );
  return result.affectedRows > 0;
}
