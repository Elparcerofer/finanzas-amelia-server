import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { reporteCompleto } from '../../services/finanzas/reporteria.service';

/** GET /api/finanzas/reporteria — indicadores, lecciones y datos de los gráficos. */
export async function reporte(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await reporteCompleto(req.usuario!.id));
  } catch (error) {
    next(error);
  }
}
