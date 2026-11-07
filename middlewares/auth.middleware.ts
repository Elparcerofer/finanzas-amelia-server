import { NextFunction, Request, Response } from 'express';
import { UsuarioSesion, verificarTokenFinanzas } from '../utils/finanzas/token_finanzas';

export { UsuarioSesion };

export interface AuthRequest extends Request {
  usuario?: UsuarioSesion;
}

/**
 * Seguridad de Finanzas = token propio, derivado de la sesión de Amelia.
 *
 *   1. La app canjea el token de Amelia (secure storage) en
 *      POST /api/finanzas/sesion. Ahí se confirma una sola vez con
 *      Amelia y se emite un token de Finanzas firmado con JWT_SECRET
 *      (ver sesion.controller.ts).
 *   2. Las demás rutas solo aceptan ese token, en
 *      `Authorization: Bearer <token>`. Se verifica aquí mismo (firma y
 *      vencimiento), sin llamar a Amelia. Los datos del usuario
 *      (USU_CODIGO, COM_CODIGO, ...) vienen dentro del token.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Si un router ya validó esta petición (middleware global + el de la
  // ruta), no se repite.
  if (req.usuario) {
    next();
    return;
  }

  const autorizacion = req.headers.authorization || '';
  const token = autorizacion.startsWith('Bearer ') ? autorizacion.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ msg: 'Inicia sesión en Amelia para usar Finanzas (falta el token)' });
    return;
  }

  let lectura;
  try {
    lectura = verificarTokenFinanzas(token);
  } catch (error) {
    next(error);
    return;
  }

  if (lectura === 'expirado') {
    res.status(401).json({ msg: 'Tu sesión expiró, vuelve a iniciar sesión' });
    return;
  }
  if (lectura === 'invalido') {
    res.status(401).json({ msg: 'Token inválido' });
    return;
  }

  req.usuario = lectura;
  next();
}
