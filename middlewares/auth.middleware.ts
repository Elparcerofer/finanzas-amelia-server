import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validarTokenEnAmelia } from '../utils/finanzas/amelia_token_validator';

export interface AuthRequest extends Request {
  usuario?: { id: number };
}

/**
 * Seguridad de Finanzas = la sesión de Amelia.
 *
 * El usuario inicia sesión en Amelia (POST /api/EmpresasAmelia/login) y
 * la app manda ese mismo token en el header `x-token` a este backend
 * (ver app_http_client_finanzas.dart). Aquí:
 *   1. Sin token → 401, en cualquier ambiente (ya no existe el "usuario
 *      de pruebas" id 0 que se dejaba pasar en desarrollo).
 *   2. Se decodifica el payload para leer el id de usuario (claim
 *      `USU_CODIGO`) y rechazar rápido si ya expiró (`exp`).
 *   3. Se confirma el token contra el propio Amelia (ver
 *      amelia_token_validator.ts). Amelia sí verifica la firma, así que
 *      si responde que el token es válido, el USU_CODIGO es auténtico.
 *      Si Amelia no responde → 503 (no se asume válido).
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Si un router ya validó esta petición (middleware global + el de la
  // ruta), no se repite.
  if (req.usuario) {
    next();
    return;
  }

  const header = req.headers['x-token'];
  const token = (Array.isArray(header) ? header[0] : header)?.trim();

  if (!token) {
    res.status(401).json({ msg: 'Inicia sesión en Amelia para usar Finanzas (falta el token)' });
    return;
  }

  const payload = decodificar(token);
  if (!payload) {
    res.status(401).json({ msg: 'Token inválido' });
    return;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    res.status(401).json({ msg: 'Tu sesión expiró, vuelve a iniciar sesión' });
    return;
  }

  const idUsuario = Number(payload.USU_CODIGO);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    res.status(401).json({ msg: 'Token sin usuario válido' });
    return;
  }

  try {
    const resultado = await validarTokenEnAmelia(token);
    if (resultado === 'sin_conexion') {
      res.status(503).json({ msg: 'No se pudo validar tu sesión con Amelia; intenta en un momento' });
      return;
    }
    if (resultado === 'invalido') {
      res.status(401).json({ msg: 'Tu sesión no es válida en Amelia, vuelve a iniciar sesión' });
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
