import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface DatosUsuarioAmelia {
  empresa: number | null; // COM_CODIGO
  usuCodigo: number; // USU_CODIGO
  alias: string | null;
  ruc: string | null;
}

/**
 * Devuelve usuarios.id para el usuario de Amelia (COM_CODIGO + USU_CODIGO),
 * creándolo si es la primera vez que entra a Finanzas.
 *
 * Usuarios heredados: antes de la tabla usuarios, usuario_id era el
 * USU_CODIGO y no se guardaba la empresa. La migración 019 los registró
 * con id = usu_codigo y com_codigo NULL; el primer inicio de sesión de
 * ese USU_CODIGO con empresa completa el com_codigo y conserva sus datos.
 */
export async function resolverUsuario(datos: DatosUsuarioAmelia): Promise<number> {
  const [encontrado] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM usuarios WHERE com_codigo <=> ? AND usu_codigo = ? LIMIT 1',
    [datos.empresa, datos.usuCodigo],
  );
  if (encontrado.length) {
    const id = Number(encontrado[0].id);
    await pool.query('UPDATE usuarios SET alias = ?, ruc = ? WHERE id = ?', [datos.alias, datos.ruc, id]);
    return id;
  }

  if (datos.empresa !== null) {
    const [reclamado] = await pool.query<ResultSetHeader>(
      `UPDATE usuarios SET com_codigo = ?, alias = ?, ruc = ?
       WHERE com_codigo IS NULL AND usu_codigo = ? AND id = usu_codigo
       LIMIT 1`,
      [datos.empresa, datos.alias, datos.ruc, datos.usuCodigo],
    );
    if (reclamado.affectedRows > 0) return datos.usuCodigo;
  }

  // ON DUPLICATE KEY: si dos inicios de sesión llegan a la vez, ambos
  // obtienen el mismo id en lugar de fallar por la clave única.
  const [creado] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuarios (com_codigo, usu_codigo, alias, ruc) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), alias = VALUES(alias), ruc = VALUES(ruc)`,
    [datos.empresa, datos.usuCodigo, datos.alias, datos.ruc],
  );
  return creado.insertId;
}
