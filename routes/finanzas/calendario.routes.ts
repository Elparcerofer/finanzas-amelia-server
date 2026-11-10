import { Router } from 'express';
import * as calendario from '../../controllers/finanzas/calendario.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

/** /api/finanzas/calendario?mes=YYYY-MM — vencimientos y pagos del mes. */
const router = Router();

router.use(authMiddleware);

router.get('/', calendario.mes);

export default router;
