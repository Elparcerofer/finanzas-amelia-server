import { Router } from 'express';
import * as reporteriaController from '../../controllers/finanzas/reporteria.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/resumen', reporteriaController.resumen);
router.get('/ingresos/historial', reporteriaController.historialIngresos);

export default router;
