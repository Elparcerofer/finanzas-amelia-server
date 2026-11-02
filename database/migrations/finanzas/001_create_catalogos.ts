import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Tabla ya existente en la BD real de pruebas (servidor pasantes).
 * Se reutiliza para 3 recursos de Flutter (entidades/empresas/categorias)
 * vía el discriminador `tipo`. Las columnas pais/telefono/rubro/cobertura/
 * grupo/subtipo/emoji/notas son adiciones de esta migración (no existían).
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      codigo VARCHAR(20) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      pais VARCHAR(60) NULL,
      telefono VARCHAR(20) NULL,
      rubro VARCHAR(80) NULL,
      cobertura VARCHAR(120) NULL,
      grupo VARCHAR(60) NULL,
      subtipo VARCHAR(30) NULL,
      emoji VARCHAR(10) NULL,
      notas VARCHAR(255) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addColumnIfMissing(pool, 'catalogos', 'pais', 'VARCHAR(60) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'telefono', 'VARCHAR(20) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'rubro', 'VARCHAR(80) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'cobertura', 'VARCHAR(120) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'grupo', 'VARCHAR(60) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'subtipo', 'VARCHAR(30) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'emoji', 'VARCHAR(10) NULL');
  await addColumnIfMissing(pool, 'catalogos', 'notas', 'VARCHAR(255) NULL');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS catalogos;');
}
