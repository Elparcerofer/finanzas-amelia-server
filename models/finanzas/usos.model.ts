import { RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

/**
 * "En uso" de cada registro de Catálogos (prototipo: usedCount /
 * "N usos" / "No se puede eliminar: está en uso en N registro(s)").
 *
 *  - Entidades, empresas y categorías son catálogos COMPARTIDOS: para
 *    bloquear el borrado se cuenta el uso de todos los usuarios; para
 *    mostrar "N usos" en la lista, solo el del usuario.
 *  - Tarjetas y cuentas son del usuario: siempre se cuenta lo suyo.
 */

export type TipoUso = 'entidades' | 'empresas' | 'categorias' | 'tarjetas' | 'cuentas';
export type MapaUsos = Record<TipoUso, Record<string, number>>;

async function contar(sql: string, params: unknown[]): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.n || 0);
}

/** Usos de cualquier usuario (para bloquear el borrado de catálogos compartidos). */
export async function usosGlobales(tipo: 'entidades' | 'empresas' | 'categorias', id: number): Promise<number> {
  switch (tipo) {
    case 'entidades':
      return contar(
        `SELECT
           (SELECT COUNT(*) FROM deudas WHERE catalogo_id = ?)
         + (SELECT COUNT(*) FROM tarjetas_credito WHERE catalogo_id = ? AND activa = 1)
         + (SELECT COUNT(*) FROM cuentas WHERE entidad_id = ?)
         + (SELECT COUNT(*) FROM deudas WHERE paga_con = ?) AS n`,
        [id, id, id, `e:${id}`],
      );
    case 'empresas':
      return contar('SELECT COUNT(*) AS n FROM deudas WHERE catalogo_id = ?', [id]);
    case 'categorias':
      return contar(
        `SELECT
           (SELECT COUNT(*) FROM deudas WHERE categoria_id = ?)
         + (SELECT COUNT(*) FROM consumos_tarjeta WHERE categoria_id = ?) AS n`,
        [id, id],
      );
  }
}

/** Usos de una tarjeta o cuenta del usuario. */
export async function usosPropios(usuarioId: number, tipo: 'tarjetas' | 'cuentas', id: number): Promise<number> {
  if (tipo === 'tarjetas') {
    return contar(
      `SELECT
         (SELECT COUNT(*) FROM deudas WHERE usuario_id = ? AND tarjeta_credito_id = ?)
       + (SELECT COUNT(*) FROM deudas WHERE usuario_id = ? AND paga_con = ?) AS n`,
      [usuarioId, id, usuarioId, `t:${id}`],
    );
  }
  return contar(
    `SELECT
       (SELECT COUNT(*) FROM tarjetas_credito WHERE usuario_id = ? AND cuenta_debito_id = ? AND activa = 1)
     + (SELECT COUNT(*) FROM deudas WHERE usuario_id = ? AND paga_con = ?) AS n`,
    [usuarioId, id, usuarioId, `c:${id}`],
  );
}

/** "N usos" de todo lo que ve el usuario en Catálogos, en una sola llamada. */
export async function mapaUsosDelUsuario(usuarioId: number): Promise<MapaUsos> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 'entidades' AS tipo, catalogo_id AS id, COUNT(*) AS n
       FROM deudas WHERE usuario_id = ? AND catalogo_id IS NOT NULL GROUP BY catalogo_id
     UNION ALL
     SELECT 'entidades', catalogo_id, COUNT(*) FROM tarjetas_credito
       WHERE usuario_id = ? AND activa = 1 GROUP BY catalogo_id
     UNION ALL
     SELECT 'entidades', entidad_id, COUNT(*) FROM cuentas
       WHERE usuario_id = ? AND entidad_id IS NOT NULL GROUP BY entidad_id
     UNION ALL
     SELECT 'categorias', categoria_id, COUNT(*) FROM deudas
       WHERE usuario_id = ? AND categoria_id IS NOT NULL GROUP BY categoria_id
     UNION ALL
     SELECT 'categorias', ct.categoria_id, COUNT(*) FROM consumos_tarjeta ct
       JOIN deudas d ON d.id = ct.deuda_id
       WHERE d.usuario_id = ? AND ct.categoria_id IS NOT NULL GROUP BY ct.categoria_id
     UNION ALL
     SELECT 'tarjetas', tarjeta_credito_id, COUNT(*) FROM deudas
       WHERE usuario_id = ? AND tarjeta_credito_id IS NOT NULL GROUP BY tarjeta_credito_id
     UNION ALL
     SELECT 'cuentas', cuenta_debito_id, COUNT(*) FROM tarjetas_credito
       WHERE usuario_id = ? AND activa = 1 AND cuenta_debito_id IS NOT NULL GROUP BY cuenta_debito_id
     UNION ALL
     SELECT CASE LEFT(paga_con, 1) WHEN 'c' THEN 'cuentas' WHEN 't' THEN 'tarjetas' ELSE 'entidades' END,
            CAST(SUBSTRING(paga_con, 3) AS UNSIGNED), COUNT(*)
       FROM deudas WHERE usuario_id = ? AND paga_con IS NOT NULL GROUP BY paga_con`,
    Array(8).fill(usuarioId),
  );

  const mapa: MapaUsos = { entidades: {}, empresas: {}, categorias: {}, tarjetas: {}, cuentas: {} };
  for (const r of rows) {
    const tipo = r.tipo as TipoUso;
    const id = String(r.id);
    mapa[tipo][id] = (mapa[tipo][id] || 0) + Number(r.n);
  }
  // deudas.catalogo_id apunta a entidad O a empresa (según el tipo de
  // crédito): el mismo conteo sirve para ambas pestañas; la app lo lee
  // por id y cada id existe solo en una de las dos.
  mapa.empresas = { ...mapa.entidades };
  return mapa;
}
