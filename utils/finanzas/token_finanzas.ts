/**
 * Token propio de Finanzas.
 *
 * Se emite en POST /api/finanzas/sesion a partir del token de Amelia
 * (ver sesion.controller.ts) y es el único que aceptan las demás rutas.
 * Lo firma Finanzas con JWT_SECRET, así que cualquier cambio en sus datos
 * (por ejemplo otro USU_CODIGO) invalida la firma.
 */
import jwt from 'jsonwebtoken';
import { HttpError } from '../../middlewares/error.middleware';

export interface UsuarioSesion {
  /**
   * usuarios.id: la clave con la que Finanzas separa los datos de cada
   * usuario (columna usuario_id de todas las tablas). Se obtiene de
   * COM_CODIGO + USU_CODIGO en el canje de sesión.
   */
  id: number;
  usuCodigo: number; // USU_CODIGO
  empresa: number | null; // COM_CODIGO
  puntoEmision: number | null; // PUN_CODIGO
  vendedor: number | null; // VEN_CODIGO
  perfil: number | null; // PERFIL_CODIGO
  alias: string | null; // alias_usuario
  ruc: string | null;
}

const EMISOR = 'finanzas-amelia';
const ALGORITMO = 'HS256';
const DURACION_POR_DEFECTO_S = 12 * 60 * 60;

// Se lee en cada llamada y no al cargar el módulo: index.ts ejecuta
// dotenv.config() después de sus imports.
function secreto(): string {
  const valor = process.env.JWT_SECRET?.trim() || '';
  if (valor.length < 32 || valor === 'change_this_secret') {
    // Sin un secreto real no se emiten ni aceptan tokens.
    throw new HttpError(500, 'Finanzas no tiene configurado JWT_SECRET');
  }
  return valor;
}

/** Segundos de vida del token de Finanzas; nunca supera al de Amelia. */
function duracionSegundos(expAmelia: number | null): number {
  const configurada = Number(process.env.JWT_EXPIRES_IN_SECONDS);
  let duracion = Number.isInteger(configurada) && configurada > 0 ? configurada : DURACION_POR_DEFECTO_S;
  if (expAmelia !== null) {
    duracion = Math.min(duracion, expAmelia - Math.floor(Date.now() / 1000));
  }
  return duracion;
}

export function emitirTokenFinanzas(usuario: UsuarioSesion, expAmelia: number | null): { token: string; exp: number } {
  const duracion = duracionSegundos(expAmelia);
  if (duracion <= 0) throw new HttpError(401, 'Tu sesión expiró, vuelve a iniciar sesión');

  const exp = Math.floor(Date.now() / 1000) + duracion;
  const token = jwt.sign({ usuario, exp }, secreto(), { algorithm: ALGORITMO, issuer: EMISOR });
  return { token, exp };
}

export type LecturaToken = UsuarioSesion | 'expirado' | 'invalido';

export function verificarTokenFinanzas(token: string): LecturaToken {
  const clave = secreto();
  try {
    const payload = jwt.verify(token, clave, { algorithms: [ALGORITMO], issuer: EMISOR });
    const usuario = typeof payload === 'object' ? (payload.usuario as UsuarioSesion | undefined) : undefined;
    // Los tokens emitidos antes de la tabla usuarios no traen usuCodigo
    // (su id era el USU_CODIGO): se rechazan para forzar un canje nuevo.
    if (!usuario || !Number.isInteger(usuario.id) || usuario.id <= 0 || !Number.isInteger(usuario.usuCodigo)) {
      return 'invalido';
    }
    return usuario;
  } catch (error) {
    return error instanceof jwt.TokenExpiredError ? 'expirado' : 'invalido';
  }
}
