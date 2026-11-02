import { Pool } from 'mysql2/promise';

export const categoriasBase: { nombre: string; grupo: string; subtipo: string; emoji: string }[] = [
  { nombre: 'Vivienda', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '🏠' },
  { nombre: 'Alimentación', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '🍽️' },
  { nombre: 'Transporte', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '🚗' },
  { nombre: 'Salud', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '💊' },
  { nombre: 'Educación', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '📚' },
  { nombre: 'Entretenimiento', grupo: 'Gustos', subtipo: 'gusto', emoji: '🎮' },
  { nombre: 'Servicios básicos', grupo: 'Necesidades', subtipo: 'necesidad', emoji: '💡' },
  { nombre: 'Deudas y créditos', grupo: 'Obligaciones', subtipo: 'obligacionFinanciera', emoji: '💳' },
  { nombre: 'Ahorro e inversión', grupo: 'Ahorro', subtipo: 'ahorroInversion', emoji: '💰' },
  { nombre: 'Otros', grupo: 'Sin clasificar', subtipo: 'sinClasificar', emoji: '📦' },
];

export async function seedCategorias(pool: Pool): Promise<void> {
  for (const c of categoriasBase) {
    const [existe] = await pool.query("SELECT id FROM catalogos WHERE nombre = ? AND tipo = 'categoria'", [c.nombre]);
    if ((existe as unknown[]).length > 0) continue;
    await pool.query(
      "INSERT INTO catalogos (tipo, nombre, grupo, subtipo, emoji, activo) VALUES ('categoria', ?, ?, ?, ?, 1)",
      [c.nombre, c.grupo, c.subtipo, c.emoji],
    );
  }
}
