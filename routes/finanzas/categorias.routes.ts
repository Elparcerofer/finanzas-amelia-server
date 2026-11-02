import { Router } from 'express';
import * as categoriasController from '../../controllers/finanzas/categorias.controller';
import { validate } from '../../middlewares/validate.middleware';
import { guardarCategoriaSchema, idParamsSchema } from '../../schema/finanzas/categorias.schema';

const router = Router();

router.get('/', categoriasController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), categoriasController.obtener);
router.post('/', validate(guardarCategoriaSchema), categoriasController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarCategoriaSchema), categoriasController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), categoriasController.eliminar);

export default router;
