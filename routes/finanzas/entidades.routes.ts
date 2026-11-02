import { Router } from 'express';
import * as entidadesController from '../../controllers/finanzas/entidades.controller';
import { validate } from '../../middlewares/validate.middleware';
import { guardarEntidadSchema, idParamsSchema } from '../../schema/finanzas/entidades.schema';

const router = Router();

router.get('/', entidadesController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), entidadesController.obtener);
router.post('/', validate(guardarEntidadSchema), entidadesController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarEntidadSchema), entidadesController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), entidadesController.eliminar);

export default router;
