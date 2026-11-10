import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Categorías que usan Inicio y Reportes para repartir cada pago
 * (prototipo Solvenza: catsOfMov, TIPO_CAT, CAT_SYS):
 *
 *  - Del sistema (no se eligen a mano): intereses, seguros y multas van
 *    solos a "costo financiero"; "sin categoría" para lo no clasificado.
 *  - Por defecto según el tipo de crédito: hipotecario → vivienda,
 *    vehicular → vehículo, suscripción → suscripciones,
 *    capital de trabajo / garantía → trabajo y negocio.
 *
 * Se identifican por `codigo` (estable aunque el usuario cambie el
 * nombre). `sistema` = 1 → no aparece para elegir en los formularios.
 * Idempotente.
 */

const CATEGORIAS: [codigo: string, nombre: string, grupo: string, subtipo: string, emoji: string, color: string, sistema: number][] = [
  ['intereses', 'Intereses bancarios', 'Financiero', 'obligacionFinanciera', '📈', '#ef6461', 1],
  ['seguros', 'Seguros (desgravamen, vehículo, vida)', 'Financiero', 'obligacionFinanciera', '🛡️', '#f4a825', 1],
  ['multas', 'Multas y recargos por atraso', 'Financiero', 'obligacionFinanciera', '⚠️', '#b3302b', 1],
  ['sin_categoria', 'Sin categoría', 'Otros', 'sinClasificar', '❔', '#7a84ab', 1],
  ['vivienda', 'Vivienda', 'Vivienda', 'necesidad', '🏠', '#3f52b5', 0],
  ['vehiculo', 'Vehículo (cuota, matrícula, mantenimiento)', 'Transporte', 'necesidad', '🚗', '#3f52b5', 0],
  ['suscripciones', 'Suscripciones y streaming', 'Ocio', 'gusto', '📺', '#8a63c8', 0],
  ['trabajo', 'Trabajo y negocio', 'Trabajo y negocio', 'necesidad', '💼', '#3f52b5', 0],
];

export async function up(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'categorias', 'codigo', 'VARCHAR(20) NULL AFTER id');
  await addColumnIfMissing(pool, 'categorias', 'sistema', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER activo');
  const [idx] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias' AND INDEX_NAME = 'uq_categorias_codigo'`,
  );
  if (!(idx as { total: number }[])[0].total) {
    await pool.query('ALTER TABLE categorias ADD UNIQUE KEY uq_categorias_codigo (codigo)');
  }

  for (const [codigo, nombre, grupo, subtipo, emoji, color, sistema] of CATEGORIAS) {
    const [conCodigo] = await pool.query('SELECT id FROM categorias WHERE codigo = ?', [codigo]);
    if ((conCodigo as unknown[]).length) continue;
    // Si ya existe con ese nombre (p. ej. "Vivienda" del seed), solo se le asigna el código.
    const [porNombre] = await pool.query('SELECT id FROM categorias WHERE nombre = ? AND codigo IS NULL LIMIT 1', [nombre]);
    const fila = (porNombre as { id: number }[])[0];
    if (fila) {
      await pool.query('UPDATE categorias SET codigo = ?, sistema = ? WHERE id = ?', [codigo, sistema, fila.id]);
    } else {
      await pool.query(
        'INSERT INTO categorias (codigo, nombre, grupo, subtipo, emoji, color, activo, sistema) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
        [codigo, nombre, grupo, subtipo, emoji, color, sistema],
      );
    }
  }
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('UPDATE categorias SET codigo = NULL, sistema = 0');
}
