import { NextFunction, Response, Router } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { mapaUsosDelUsuario } from '../../models/finanzas/usos.model';

/** "N usos" de cada registro de Catálogos para el usuario de la sesión. */
const router = Router();

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await mapaUsosDelUsuario(req.usuario!.id));
  } catch (error) {
    next(error);
  }
});

export default router;
