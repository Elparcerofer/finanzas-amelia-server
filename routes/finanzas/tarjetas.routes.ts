import { Router } from 'express';
import * as tarjetasController from '../../controllers/finanzas/tarjetas.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { guardarTarjetaSchema, idParamsSchema } from '../../schema/finanzas/tarjetas.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', tarjetasController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), tarjetasController.obtener);
router.post('/', validate(guardarTarjetaSchema), tarjetasController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarTarjetaSchema), tarjetasController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), tarjetasController.eliminar);

export default router;
