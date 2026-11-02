import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { tokenEsValidoEnAmelia } from '../utils/finanzas/amelia_token_validator';

export interface AuthRequest extends Request {
  usuario?: { id: number };
}

/**
 * El backend principal de Amelia firma el token que la app manda en el
 * header `x-token` (no `Authorization: Bearer`, ver
 * app_http_client_finanzas.dart). Confirmado en vivo contra
 * https://amelia-test.facturadoramelia.com/api/EmpresasAmelia/login
 * (2026-10-30): el payload del JWT trae el id de usuario en el claim
 * `USU_CODIGO`.
 *
 * Este backend no tiene el secreto con el que Amelia firma el token
 * (no existe forma segura de obtenerlo desde aquí), así que no se
 * puede hacer jwt.verify() local. En su lugar:
 *   1. Se decodifica el payload (sin verificar firma) para leer USU_CODIGO
 *      y para rechazar rápido si ya expiró (`exp`), sin llamar a Amelia.
 *   2. Se confirma el token contra el propio Amelia (ver
 *      amelia_token_validator.ts) — si Amelia dice que no es válido,
 *      se rechaza con 401. Fail-closed: si Amelia no responde, también
 *      se rechaza (no se asume válido).
 *
 * Única excepción: en desarrollo (NODE_ENV !== 'production') una
 * petición SIN ningún token se deja pasar como "usuario de pruebas" (id 0),
 * para poder probar los endpoints a mano sin tener que loguearse en
 * Amelia cada vez. Un token presente pero inválido SIEMPRE se rechaza,
 * en cualquier ambiente.
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['x-token'];
  const token = Array.isArray(header) ? header[0] : header;

  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ msg: 'Token no proporcionado' });
      return;
    }
    req.usuario = { id: 0 };
    next();
    return;
  }

  const payload = decodificar(token);
  if (!payload) {
    res.status(401).json({ msg: 'Token inválido' });
    return;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    res.status(401).json({ msg: 'Token expirado' });
    return;
  }

  const idUsuario = Number(payload.USU_CODIGO);
  if (Number.isNaN(idUsuario) || idUsuario <= 0) {
    res.status(401).json({ msg: 'Token sin usuario válido' });
    return;
  }

  try {
    const valido = await tokenEsValidoEnAmelia(token);
    if (!valido) {
      res.status(401).json({ msg: 'Token no reconocido por Amelia' });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  req.usuario = { id: idUsuario };
  next();
}

function decodificar(token: string): Record<string, unknown> | null {
  try {
    const payload = jwt.decode(token);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch (error) {
    return null;
  }
}
