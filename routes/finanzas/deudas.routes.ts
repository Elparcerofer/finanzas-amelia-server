import { Router } from 'express';
import * as deudasController from '../../controllers/finanzas/deudas.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { guardarDeudaSchema, idParamsSchema } from '../../schema/finanzas/deudas.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', deudasController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), deudasController.obtener);
router.post('/', validate(guardarDeudaSchema), deudasController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarDeudaSchema), deudasController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), deudasController.eliminar);

export default router;
