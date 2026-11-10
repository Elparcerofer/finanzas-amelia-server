import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * "Perfil y notificaciones" del prototipo Solvenza.
 *
 *  - perfiles.correo: correo para recordatorios y el resumen semanal.
 *  - perfiles.apellidos / cedula pasan a ser opcionales: el perfil se
 *    completa desde la app ("Nombre completo") y puede no tener cédula.
 *  - preferencias_notificacion: una fila por usuario con los canales de
 *    aviso (correo, push, WhatsApp, SMS), las alertas que quiere recibir
 *    y si usa logos automáticos. Valores por defecto = los del prototipo.
 *
 * Idempotente.
 */
export async function up(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'perfiles', 'correo', 'VARCHAR(256) NULL AFTER cedula');
  await pool.query('ALTER TABLE perfiles MODIFY COLUMN apellidos VARCHAR(256) NULL');
  await pool.query('ALTER TABLE perfiles MODIFY COLUMN cedula VARCHAR(256) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS preferencias_notificacion (
      usuario_id INT PRIMARY KEY,
      canal_correo TINYINT(1) NOT NULL DEFAULT 1,
      canal_push TINYINT(1) NOT NULL DEFAULT 1,
      canal_whatsapp TINYINT(1) NOT NULL DEFAULT 0,
      canal_sms TINYINT(1) NOT NULL DEFAULT 0,
      alerta_vencimiento TINYINT(1) NOT NULL DEFAULT 1,
      aviso_cupo_alto TINYINT(1) NOT NULL DEFAULT 1,
      tips_semanales TINYINT(1) NOT NULL DEFAULT 1,
      resumen_semanal TINYINT(1) NOT NULL DEFAULT 0,
      logos_automaticos TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_preferencias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS preferencias_notificacion');
  await pool.query('ALTER TABLE perfiles DROP COLUMN correo');
}
