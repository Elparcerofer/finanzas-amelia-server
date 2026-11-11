import { Pool } from 'mysql2/promise';
import { categoriasBase } from '../../seeds/finanzas/categorias.seed';

/**
 * Repara los emojis de las categorías base que quedaron guardados como
 * "??" (se insertaron cuando la tabla aún no era utf8mb4; hoy todas las
 * columnas lo son). Solo toca filas cuyo emoji está vacío o es solo
 * signos de interrogación, así que no pisa cambios del usuario.
 *
 * Idempotente.
 */
export async function up(pool: Pool): Promise<void> {
  for (const c of categoriasBase) {
    await pool.query(
      `UPDATE categorias SET emoji = ?
       WHERE nombre = ? AND (emoji IS NULL OR emoji = '' OR emoji REGEXP '^[?]+$')`,
      [c.emoji, c.nombre],
    );
  }
}

export async function down(): Promise<void> {
  // Reparación de datos: no hay nada que revertir.
}
