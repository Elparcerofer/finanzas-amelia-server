import { Router } from 'express';
import * as empresasController from '../../controllers/finanzas/empresas.controller';
import { validate } from '../../middlewares/validate.middleware';
import { guardarEmpresaSchema, idParamsSchema } from '../../schema/finanzas/empresas.schema';

const router = Router();

router.get('/', empresasController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), empresasController.obtener);
router.post('/', validate(guardarEmpresaSchema), empresasController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarEmpresaSchema), empresasController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), empresasController.eliminar);

export default router;
