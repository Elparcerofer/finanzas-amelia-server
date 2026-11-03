import { Pool } from 'mysql2/promise';

// Las entidades financieras (bancos, cooperativas, mutualistas) viven
// ahora en entidades_financieras.seed.ts — catálogo completo SB/SEPS con
// upsert por `codigo` (sin duplicados).

export const empresasEcuador: { nombre: string; rubro: string; telefono?: string }[] = [
  { nombre: 'CNEL (Electricidad)', rubro: 'Servicios básicos' },
  { nombre: 'EMAAP-Q (Agua potable Quito)', rubro: 'Servicios básicos' },
  { nombre: 'CNT (Telefonía/Internet)', rubro: 'Telecomunicaciones' },
  { nombre: 'Claro Ecuador', rubro: 'Telecomunicaciones' },
  { nombre: 'Movistar Ecuador', rubro: 'Telecomunicaciones' },
];

export async function seedEmpresas(pool: Pool): Promise<void> {
  for (const e of empresasEcuador) {
    const [existe] = await pool.query("SELECT id FROM catalogos WHERE nombre = ? AND tipo = 'empresa'", [e.nombre]);
    if ((existe as unknown[]).length > 0) continue;
    await pool.query(
      "INSERT INTO catalogos (tipo, nombre, rubro, telefono, activo) VALUES ('empresa', ?, ?, ?, 1)",
      [e.nombre, e.rubro, e.telefono || null],
    );
  }
}
