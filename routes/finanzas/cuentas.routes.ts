import { Router } from 'express';
import * as cuentasController from '../../controllers/finanzas/cuentas.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { guardarCuentaSchema, idParamsSchema } from '../../schema/finanzas/cuentas.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', cuentasController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), cuentasController.obtener);
router.post('/', validate(guardarCuentaSchema), cuentasController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarCuentaSchema), cuentasController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), cuentasController.eliminar);

export default router;
