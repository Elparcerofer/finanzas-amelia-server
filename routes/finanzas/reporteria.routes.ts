import { Router } from 'express';
import * as reporteria from '../../controllers/finanzas/reporteria.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

/** /api/finanzas/reporteria — "Reportes y análisis". */
const router = Router();

router.use(authMiddleware);

router.get('/', reporteria.reporte);

export default router;
