/**
 * "Perfil y notificaciones" (prototipo Solvenza): datos personales,
 * canales de aviso, alertas y respaldo de los datos del usuario.
 */
import { HttpError } from '../../middlewares/error.middleware';
import { listarIngresosPorUsuario } from '../../models/finanzas/ingreso.model';
import {
  cedulaDeOtro,
  guardarPerfil,
  guardarPreferencias,
  obtenerPerfil,
  obtenerPreferencias,
  Preferencias,
} from '../../models/finanzas/perfil.model';
import { esCedulaEcuatorianaValida } from '../../utils/finanzas/validadores_ec';
import { resumenGlobal } from './analisis.service';
import { cargarCartera, cargarNombres, movimientoApi } from './cartera.service';
import { obtenerDeudasDeUsuario } from './deudas.service';
import { ingresoFijo } from './ingresos.service';
import { hoyISO } from './motor/fechas';

export async function perfilCompleto(usuarioId: number) {
  const hoy = hoyISO();
  const [p, prefs, ingresos, deudas, n] = await Promise.all([
    obtenerPerfil(usuarioId),
    obtenerPreferencias(usuarioId),
    listarIngresosPorUsuario(usuarioId),
    cargarCartera(usuarioId),
    cargarNombres(usuarioId),
  ]);
  if (!p) throw new HttpError(404, 'Usuario no encontrado');
  const fijo = ingresoFijo(ingresos, hoy.slice(0, 7));
  const estimado = p.ingreso_mensual_estimado != null ? Number(p.ingreso_mensual_estimado) : null;
  const ingreso = fijo || estimado || 0;
  const G = resumenGlobal(deudas, ingreso, n, hoy);
  const nombreCompleto = [p.nombres, p.apellidos].filter(Boolean).join(' ').trim() || p.alias || '';
  return {
    nombreCompleto,
    cedula: p.cedula,
    correo: p.correo,
    telefono: p.telefono,
    /** El ingreso fijo registrado en Ingresos manda; si no hay, el estimado del perfil. */
    ingresoMensual: ingreso || null,
    ingresoDesdeIngresos: fijo > 0,
    miembroDesde: p.miembro_desde,
    plan: 'Plan Libre',
    deudas: deudas.length,
    salud: G.score,
    preferencias: prefs,
  };
}

export interface PerfilInput {
  nombreCompleto: string;
  cedula?: string | null;
  correo?: string | null;
  telefono?: string | null;
  ingresoMensual?: number | null;
}

/** "Nombre completo" → nombres y apellidos (2 nombres + resto, o mitad y mitad). */
function separarNombre(completo: string): { nombres: string; apellidos: string | null } {
  const p = completo.trim().split(/\s+/);
  if (p.length === 1) return { nombres: p[0], apellidos: null };
  const corte = p.length >= 4 ? 2 : p.length === 3 ? 1 : 1;
  return { nombres: p.slice(0, corte).join(' '), apellidos: p.slice(corte).join(' ') };
}

export async function actualizarPerfil(usuarioId: number, e: PerfilInput) {
  const cedula = e.cedula?.trim() || null;
  if (cedula) {
    if (!esCedulaEcuatorianaValida(cedula)) throw new HttpError(422, 'Cédula ecuatoriana inválida');
    if (await cedulaDeOtro(usuarioId, cedula)) throw new HttpError(409, 'Esa cédula ya está registrada en otro perfil');
  }
  const { nombres, apellidos } = separarNombre(e.nombreCompleto);
  await guardarPerfil(usuarioId, {
    nombres,
    apellidos,
    cedula,
    correo: e.correo?.trim() || null,
    telefono: e.telefono?.trim() || null,
    ingresoMensual: e.ingresoMensual ?? null,
  });
  return perfilCompleto(usuarioId);
}

export async function actualizarPreferencias(usuarioId: number, cambios: Partial<Preferencias>) {
  await guardarPreferencias(usuarioId, cambios);
  return obtenerPreferencias(usuarioId);
}

/** "Exportar respaldo (.json)": deudas, pagos e ingresos del usuario. */
export async function respaldo(usuarioId: number) {
  const [perfil, deudas, cartera, n, ingresos] = await Promise.all([
    perfilCompleto(usuarioId),
    obtenerDeudasDeUsuario(usuarioId),
    cargarCartera(usuarioId),
    cargarNombres(usuarioId),
    listarIngresosPorUsuario(usuarioId),
  ]);
  return {
    version: 1,
    generado: new Date().toISOString(),
    perfil,
    deudas,
    pagos: cartera.flatMap((d) => d.movs.map((m) => movimientoApi(d, m, n))),
    ingresos: ingresos.map((i) => ({
      fuente: i.fuente_nombre,
      descripcion: i.descripcion,
      monto: Number(i.monto),
      fecha: i.fecha,
      periodicidad: i.periodicidad,
      hasta: i.hasta,
    })),
  };
}
