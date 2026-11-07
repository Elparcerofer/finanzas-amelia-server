/**
 * Lectura y validación del token de Amelia, solo para el canje en
 * POST /api/finanzas/sesion.
 *
 * Los datos del usuario se leen del propio payload. Como Finanzas no
 * tiene el secreto con el que Amelia firma, se le pregunta una vez a
 * Amelia si el token es real (un endpoint autenticado liviano:
 * sin token o inválido → 401, válido → 200). Después del canje, las
 * peticiones usan el token propio de Finanzas y no vuelven a llamar a
 * Amelia. Si Amelia no responde, no se emite token (fail-closed).
 */
import jwt from 'jsonwebtoken';
import { UsuarioSesion } from './token_finanzas';

const AMELIA_PING_PATH = '/api/companias';
const TIMEOUT_MS = 5000;

export interface DatosTokenAmelia {
  /** Sin `id`: el id de Finanzas (usuarios.id) se resuelve en el canje. */
  usuario: Omit<UsuarioSesion, 'id'>;
  exp: number | null;
}

export type ResultadoValidacion = 'valido' | 'invalido' | 'sin_conexion';

/** null si no es un JWT legible o no trae un USU_CODIGO válido; 'expirado' si ya venció. */
export function leerTokenAmelia(token: string): DatosTokenAmelia | 'expirado' | null {
  let payload: unknown;
  try {
    payload = jwt.decode(token);
  } catch (error) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const datos = payload as Record<string, unknown>;
  const exp = typeof datos.exp === 'number' ? datos.exp : null;
  if (exp !== null && exp * 1000 <= Date.now()) return 'expirado';

  const id = Number(datos.USU_CODIGO);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    exp,
    usuario: {
      usuCodigo: id,
      empresa: entero(datos.COM_CODIGO),
      puntoEmision: entero(datos.PUN_CODIGO),
      vendedor: entero(datos.VEN_CODIGO),
      perfil: entero(datos.PERFIL_CODIGO),
      alias: texto(datos.alias_usuario),
      ruc: texto(datos.ruc),
    },
  };
}

export async function validarTokenEnAmelia(token: string): Promise<ResultadoValidacion> {
  const base = process.env.AMELIA_BASE_URL || 'https://amelia-test.facturadoramelia.com';
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${base}${AMELIA_PING_PATH}`, {
      headers: { 'x-token': token },
      signal: controlador.signal,
    });
    if (respuesta.status >= 200 && respuesta.status < 300) return 'valido';
    if (respuesta.status === 401 || respuesta.status === 403) return 'invalido';
    // 5xx u otra respuesta inesperada: Amelia no pudo decidir.
    return 'sin_conexion';
  } catch (error) {
    return 'sin_conexion';
  } finally {
    clearTimeout(timeout);
  }
}

function entero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}
