import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_internas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo_evento VARCHAR(30) NOT NULL,
      titulo VARCHAR(150) NOT NULL,
      mensaje VARCHAR(500) NOT NULL,
      referencia_tipo VARCHAR(20) NOT NULL,
      referencia_id INT NOT NULL,
      leida TINYINT(1) NOT NULL DEFAULT 0,
      leida_en TIMESTAMP NULL,
      reenviada_a_bot TINYINT(1) NOT NULL DEFAULT 0,
      reenviada_en TIMESTAMP NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notificaciones_usuario_id (usuario_id),
      INDEX idx_notificaciones_reenviada_a_bot (reenviada_a_bot)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS notificaciones_internas;');
}
