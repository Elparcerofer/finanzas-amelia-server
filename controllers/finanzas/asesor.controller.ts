import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { generarRecomendaciones } from '../../services/finanzas/asesor.service';

export async function recomendaciones(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await generarRecomendaciones(req.usuario!.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}
