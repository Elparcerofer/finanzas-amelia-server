import { Router } from 'express';
import * as ingresosController from '../../controllers/finanzas/ingresos.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { actualizarIngresoSchema, crearIngresoSchema, idParamsSchema } from '../../schema/finanzas/ingresos.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', ingresosController.listar);
router.get('/:id', validate(idParamsSchema, 'params'), ingresosController.obtener);
router.post('/', validate(crearIngresoSchema), ingresosController.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(actualizarIngresoSchema), ingresosController.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), ingresosController.eliminar);

export default router;
