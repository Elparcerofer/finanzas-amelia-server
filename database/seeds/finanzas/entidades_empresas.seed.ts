import { Pool } from 'mysql2/promise';

export const entidadesEcuador: { nombre: string; tipo: string; codigo: string; pais: string }[] = [
  { nombre: 'Banco Pichincha', tipo: 'banco', codigo: 'PICHINCHA', pais: 'Ecuador' },
  { nombre: 'Banco de Guayaquil', tipo: 'banco', codigo: 'GUAYAQUIL', pais: 'Ecuador' },
  { nombre: 'Produbanco', tipo: 'banco', codigo: 'PRODUBANCO', pais: 'Ecuador' },
  { nombre: 'Banco Internacional', tipo: 'banco', codigo: 'INTERNACIONAL', pais: 'Ecuador' },
  { nombre: 'Banco del Pacífico', tipo: 'banco', codigo: 'PACIFICO', pais: 'Ecuador' },
  { nombre: 'Banco Bolivariano', tipo: 'banco', codigo: 'BOLIVARIANO', pais: 'Ecuador' },
  { nombre: 'Banco Austro', tipo: 'banco', codigo: 'AUSTRO', pais: 'Ecuador' },
  { nombre: 'Banco General Rumiñahui', tipo: 'banco', codigo: 'RUMINAHUI', pais: 'Ecuador' },
  { nombre: 'BanEcuador', tipo: 'bancoPublico', codigo: 'BANECUADOR', pais: 'Ecuador' },
  { nombre: 'Cooperativa JEP', tipo: 'cooperativa', codigo: 'JEP', pais: 'Ecuador' },
  { nombre: 'Cooperativa Policía Nacional', tipo: 'cooperativa', codigo: 'COOPPOLICIA', pais: 'Ecuador' },
];

export const empresasEcuador: { nombre: string; rubro: string; telefono?: string }[] = [
  { nombre: 'CNEL (Electricidad)', rubro: 'Servicios básicos' },
  { nombre: 'EMAAP-Q (Agua potable Quito)', rubro: 'Servicios básicos' },
  { nombre: 'CNT (Telefonía/Internet)', rubro: 'Telecomunicaciones' },
  { nombre: 'Claro Ecuador', rubro: 'Telecomunicaciones' },
  { nombre: 'Movistar Ecuador', rubro: 'Telecomunicaciones' },
];

export async function seedEntidadesEmpresas(pool: Pool): Promise<void> {
  for (const e of entidadesEcuador) {
    // catalogos.tipo solo admite 'banco'/'empresa'/'categoria' (CHECK real);
    // el subtipo fino (banco/bancoPublico/cooperativa/...) va en `subtipo`.
    const [existe] = await pool.query('SELECT id FROM catalogos WHERE nombre = ? AND tipo = \'banco\'', [e.nombre]);
    if ((existe as unknown[]).length > 0) continue;
    await pool.query(
      "INSERT INTO catalogos (tipo, nombre, subtipo, codigo, pais, activo) VALUES ('banco', ?, ?, ?, ?, 1)",
      [e.nombre, e.tipo, e.codigo, e.pais],
    );
  }

  for (const e of empresasEcuador) {
    const [existe] = await pool.query("SELECT id FROM catalogos WHERE nombre = ? AND tipo = 'empresa'", [e.nombre]);
    if ((existe as unknown[]).length > 0) continue;
    await pool.query(
      "INSERT INTO catalogos (tipo, nombre, rubro, telefono, activo) VALUES ('empresa', ?, ?, ?, 1)",
      [e.nombre, e.rubro, e.telefono || null],
    );
  }
}
