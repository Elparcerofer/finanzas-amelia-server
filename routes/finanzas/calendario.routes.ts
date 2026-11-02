import { Router } from 'express';
import * as calendarioController from '../../controllers/finanzas/calendario.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', calendarioController.listar);
router.post('/', calendarioController.crear);
router.delete('/:id', calendarioController.eliminar);

export default router;
