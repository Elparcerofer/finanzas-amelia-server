import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Prototipo "Solvenza" (Registrar deuda y Catálogos):
 *  - Suscripciones: "¿Con qué se paga?" (solo informativo, para
 *    reportes). Se guarda como referencia tipada:
 *      c:<id cuenta> · t:<id tarjeta> · e:<id entidad> (débito en entidad)
 *  - Categorías: "Color" de la categoría (hex, ej. #26bd97).
 *
 * El color de la tarjeta ya existía (tarjetas_credito.color).
 * Idempotente (addColumnIfMissing); no toca datos existentes.
 */
export async function up(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'deudas', 'paga_con', 'VARCHAR(30) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'color', 'VARCHAR(20) NULL');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('ALTER TABLE catalogos DROP COLUMN color');
  await pool.query('ALTER TABLE deudas DROP COLUMN paga_con');
}
