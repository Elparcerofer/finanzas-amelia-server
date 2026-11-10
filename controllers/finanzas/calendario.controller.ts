import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { calendarioMes } from '../../services/finanzas/calendario.service';

/** GET /api/finanzas/calendario?mes=YYYY-MM */
export async function mes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await calendarioMes(req.usuario!.id, (req.query.mes as string) || undefined));
  } catch (error) {
    next(error);
  }
}
