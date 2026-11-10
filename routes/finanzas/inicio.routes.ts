import { Router } from 'express';
import * as inicio from '../../controllers/finanzas/inicio.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', inicio.resumen);

export default router;
