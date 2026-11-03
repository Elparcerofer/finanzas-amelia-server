import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';
import { WEB_EMPRESAS, WEB_ENTIDADES } from '../../seeds/finanzas/sitios_web.data';

/**
 * Prototipo "Solvenza":
 *  - Entidades y empresas tienen "Sitio web" (para el logo automático)
 *    y "Logo" propio (imagen ya optimizada a 128×128 por la app, se
 *    guarda como data URI — por eso MEDIUMTEXT).
 *  - La tabla de amortización puede ser generada con los datos del
 *    usuario o subida desde el archivo del banco (`origen`).
 *
 * Los consumos de tarjeta (registro detallado) NO necesitan cambios:
 * la tabla consumos_tarjeta ya existe con todo lo que pide el prototipo.
 *
 * Idempotente: columnas con addColumnIfMissing y los sitios web solo se
 * llenan donde `web` sigue vacío.
 */
export async function up(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'catalogos', 'web', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'logo', 'MEDIUMTEXT NULL');
  await addColumnIfMissing(
    pool,
    'tablas_amortizacion',
    'origen',
    "VARCHAR(10) NOT NULL DEFAULT 'generada'",
  );

  const sitios: [string, Record<string, string>][] = [
    ['banco', WEB_ENTIDADES],
    ['empresa', WEB_EMPRESAS],
  ];
  for (const [tipo, mapa] of sitios) {
    for (const [nombre, dominio] of Object.entries(mapa)) {
      await pool.query(
        "UPDATE catalogos SET web = ? WHERE tipo = ? AND nombre = ? AND (web IS NULL OR web = '')",
        [`https://${dominio}`, tipo, nombre],
      );
    }
  }
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('ALTER TABLE tablas_amortizacion DROP COLUMN origen');
  await pool.query('ALTER TABLE catalogos DROP COLUMN logo');
  await pool.query('ALTER TABLE catalogos DROP COLUMN web');
}
