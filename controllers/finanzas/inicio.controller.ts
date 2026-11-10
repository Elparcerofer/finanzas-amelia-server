import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { resumenInicio } from '../../services/finanzas/inicio.service';

/** GET /api/finanzas/inicio — datos del dashboard. */
export async function resumen(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await resumenInicio(req.usuario!.id));
  } catch (error) {
    next(error);
  }
}
