import { NextFunction, Request, Response } from 'express';
import { emitirTokenFinanzas } from '../../utils/finanzas/token_finanzas';
import { leerTokenAmelia, validarTokenEnAmelia } from '../../utils/finanzas/token_amelia';
import { resolverUsuario } from '../../models/finanzas/usuario.model';

/**
 * POST /api/finanzas/sesion — canje del token de Amelia (header `x-token`)
 * por el token propio de Finanzas. Es la única ruta que consulta a Amelia.
 * Respuesta: { token, exp } (exp en segundos desde epoch).
 */
export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['x-token'];
  const tokenAmelia = (Array.isArray(header) ? header[0] : header)?.trim();

  if (!tokenAmelia) {
    res.status(401).json({ msg: 'Inicia sesión en Amelia para usar Finanzas (falta el token)' });
    return;
  }

  const datos = leerTokenAmelia(tokenAmelia);
  if (datos === 'expirado') {
    res.status(401).json({ msg: 'Tu sesión expiró, vuelve a iniciar sesión' });
    return;
  }
  if (!datos) {
    res.status(401).json({ msg: 'Token sin usuario válido' });
    return;
  }

  try {
    const resultado = await validarTokenEnAmelia(tokenAmelia);
    if (resultado === 'sin_conexion') {
      res.status(503).json({ msg: 'No se pudo validar tu sesión con Amelia; intenta en un momento' });
      return;
    }
    if (resultado === 'invalido') {
      res.status(401).json({ msg: 'Tu sesión no es válida en Amelia, vuelve a iniciar sesión' });
      return;
    }

    const id = await resolverUsuario(datos.usuario);
    res.json(emitirTokenFinanzas({ ...datos.usuario, id }, datos.exp));
  } catch (error) {
    next(error);
  }
}
