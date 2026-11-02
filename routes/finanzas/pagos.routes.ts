import { Router } from 'express';
import * as pagosController from '../../controllers/finanzas/pagos.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { crearPagoSchema, idParamsSchema } from '../../schema/finanzas/pagos.schema';

const router = Router();

router.use(authMiddleware);

router.get('/deuda/:deudaId', pagosController.listarPorDeuda);
router.get('/:id', validate(idParamsSchema, 'params'), pagosController.obtener);
router.post('/', validate(crearPagoSchema), pagosController.crear);
router.delete('/:id', validate(idParamsSchema, 'params'), pagosController.eliminar);

export default router;
