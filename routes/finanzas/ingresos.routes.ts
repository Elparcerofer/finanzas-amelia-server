import { Router } from 'express';
import * as ingresos from '../../controllers/finanzas/ingresos.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { guardarIngresoSchema, idParamsSchema } from '../../schema/finanzas/ingresos.schema';

/**
 * /api/finanzas/ingresos
 *   GET    /           ingresos + capacidad de pago + flujo 12 meses
 *   GET    /fuentes    catálogo de fuentes agrupado por clase
 *   POST   /           registra un ingreso
 *   PUT    /:id        edita
 *   DELETE /:id        elimina
 */
const router = Router();

router.use(authMiddleware);

router.get('/', ingresos.resumen);
router.get('/fuentes', ingresos.fuentes);
router.post('/', validate(guardarIngresoSchema), ingresos.crear);
router.put('/:id', validate(idParamsSchema, 'params'), validate(guardarIngresoSchema), ingresos.actualizar);
router.delete('/:id', validate(idParamsSchema, 'params'), ingresos.eliminar);

export default router;
