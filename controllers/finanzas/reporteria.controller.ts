import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { generarHistorialIngresos, generarResumenFinanciero } from '../../services/finanzas/reporteria.service';

export async function resumen(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await generarResumenFinanciero(req.usuario!.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function historialIngresos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await generarHistorialIngresos(req.usuario!.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}
