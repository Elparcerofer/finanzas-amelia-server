import { Router } from 'express';
import * as asesorController from '../../controllers/finanzas/asesor.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/recomendaciones', asesorController.recomendaciones);

export default router;
