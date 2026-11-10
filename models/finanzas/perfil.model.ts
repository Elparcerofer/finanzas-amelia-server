import { RowDataPacket } from 'mysql2';
import pool from '../../database/pool';

export interface PerfilFila extends RowDataPacket {
  nombres: string | null;
  apellidos: string | null;
  cedula: string | null;
  correo: string | null;
  telefono: string | null;
  ingreso_mensual_estimado: string | null;
  alias: string | null;
  miembro_desde: string;
}

/** Perfil + datos del usuario de Amelia (alias y fecha de alta en Finanzas). */
export async function obtenerPerfil(usuarioId: number): Promise<PerfilFila | null> {
  const [rows] = await pool.query<PerfilFila[]>(
    `SELECT p.nombres, p.apellidos, p.cedula, p.correo, p.telefono, p.ingreso_mensual_estimado,
            u.alias, DATE_FORMAT(u.creado_en, '%Y-%m-%d') AS miembro_desde
     FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id
     WHERE u.id = ?`,
    [usuarioId],
  );
  return rows[0] || null;
}

export interface PerfilDb {
  nombres: string;
  apellidos: string | null;
  cedula: string | null;
  correo: string | null;
  telefono: string | null;
  ingresoMensual: number | null;
}

/** Crea o actualiza el perfil (uno por usuario). */
export async function guardarPerfil(usuarioId: number, p: PerfilDb): Promise<void> {
  await pool.query(
    `INSERT INTO perfiles (usuario_id, nombres, apellidos, cedula, correo, telefono, ingreso_mensual_estimado)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombres = VALUES(nombres), apellidos = VALUES(apellidos), cedula = VALUES(cedula),
       correo = VALUES(correo), telefono = VALUES(telefono), ingreso_mensual_estimado = VALUES(ingreso_mensual_estimado)`,
    [usuarioId, p.nombres, p.apellidos, p.cedula, p.correo, p.telefono, p.ingresoMensual],
  );
}

/** true si otra persona ya registró esa cédula. */
export async function cedulaDeOtro(usuarioId: number, cedula: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM perfiles WHERE cedula = ? AND usuario_id <> ? LIMIT 1', [
    cedula,
    usuarioId,
  ]);
  return rows.length > 0;
}

/* -------------------------------------------------------- preferencias */

export const PREFERENCIAS = {
  canalCorreo: 'canal_correo',
  canalPush: 'canal_push',
  canalWhatsapp: 'canal_whatsapp',
  canalSms: 'canal_sms',
  alertaVencimiento: 'alerta_vencimiento',
  avisoCupoAlto: 'aviso_cupo_alto',
  tipsSemanales: 'tips_semanales',
  resumenSemanal: 'resumen_semanal',
  logosAutomaticos: 'logos_automaticos',
} as const;

export type Preferencias = Record<keyof typeof PREFERENCIAS, boolean>;

const POR_DEFECTO: Preferencias = {
  canalCorreo: true,
  canalPush: true,
  canalWhatsapp: false,
  canalSms: false,
  alertaVencimiento: true,
  avisoCupoAlto: true,
  tipsSemanales: true,
  resumenSemanal: false,
  logosAutomaticos: true,
};

export async function obtenerPreferencias(usuarioId: number): Promise<Preferencias> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM preferencias_notificacion WHERE usuario_id = ?', [usuarioId]);
  const f = rows[0];
  if (!f) return { ...POR_DEFECTO };
  return Object.fromEntries(
    (Object.entries(PREFERENCIAS) as [keyof Preferencias, string][]).map(([k, col]) => [k, Number(f[col]) === 1]),
  ) as Preferencias;
}

/** Guarda solo las preferencias enviadas (las demás quedan como estaban). */
export async function guardarPreferencias(usuarioId: number, cambios: Partial<Preferencias>): Promise<void> {
  const actuales = await obtenerPreferencias(usuarioId);
  const p = { ...actuales, ...cambios };
  const cols = Object.values(PREFERENCIAS);
  const vals = (Object.keys(PREFERENCIAS) as (keyof Preferencias)[]).map((k) => (p[k] ? 1 : 0));
  await pool.query(
    `INSERT INTO preferencias_notificacion (usuario_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${cols.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
    [usuarioId, ...vals],
  );
}
