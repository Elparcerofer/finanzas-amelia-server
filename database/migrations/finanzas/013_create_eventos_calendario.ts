import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      titulo VARCHAR(150) NOT NULL,
      fecha DATE NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      referencia_id INT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_eventos_calendario_usuario_id (usuario_id)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS eventos_calendario;');
}
