import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { verificarTokenFinanzas } from '../utils/finanzas/token_finanzas';

/**
 * Límite de peticiones.
 *
 * - Con token de Finanzas válido se cuenta POR USUARIO: cada pantalla hace
 *   varias peticiones (Inicio ≈ 6) y, detrás de un proxy o en la misma red,
 *   muchos usuarios comparten IP; contar por IP los bloqueaba entre sí.
 * - Sin token (canje de sesión, rutas públicas) se cuenta por IP con un
 *   límite más bajo, para frenar abusos sin sesión.
 *
 * Variables: RATE_LIMIT_WINDOW_MS (ventana), RATE_LIMIT_MAX (por usuario)
 * y RATE_LIMIT_MAX_ANONIMO (por IP sin sesión).
 */
function usuarioDelToken(req: Request): number | null {
  const autorizacion = req.headers.authorization || '';
  if (!autorizacion.startsWith('Bearer ')) return null;
  try {
    const lectura = verificarTokenFinanzas(autorizacion.slice(7).trim());
    return typeof lectura === 'object' ? lectura.id : null;
  } catch {
    // Sin JWT_SECRET configurado: se cuenta por IP (el authMiddleware
    // responderá el error real).
    return null;
  }
}

const entero = (valor: string | undefined, porDefecto: number): number => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
};

export const rateLimitMiddleware = rateLimit({
  windowMs: entero(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: (req) =>
    usuarioDelToken(req) !== null
      ? entero(process.env.RATE_LIMIT_MAX, 1000)
      : entero(process.env.RATE_LIMIT_MAX_ANONIMO, 100),
  keyGenerator: (req) => {
    const usuario = usuarioDelToken(req);
    return usuario !== null ? `u:${usuario}` : `ip:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  // `msg`: es la clave que la app muestra en los errores (igual que el
  // resto de respuestas de error de la API).
  message: { msg: 'Hiciste demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.' },
});
