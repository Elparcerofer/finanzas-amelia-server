import { Router } from 'express';
import * as consumos from '../../controllers/finanzas/consumos.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  conciliacionSchema,
  consumoParamsSchema,
  consumoSchema,
  deudaParamsSchema,
  itemsSchema,
  panelQuerySchema,
  pdfSchema,
  periodoParamsSchema,
  simularQuerySchema,
} from '../../schema/finanzas/consumos.schema';

/**
 * /api/finanzas/consumos — "Consumos y conciliación"
 *   GET    /                                          deudas (lista izquierda)
 *   GET    /deuda/:deudaId?periodo=YYYY-MM            panel de la deuda
 *   GET    /deuda/:deudaId/simular?monto=&despues=    abono a capital: plazo vs. cuota
 *   POST   /deuda/:deudaId/consumos                   agrega un consumo (tarjeta detallada)
 *   DELETE /deuda/:deudaId/consumos/:consumoId        quita un consumo
 *   PUT    /deuda/:deudaId/conciliacion/:periodo      valor del estado, pago real y fecha
 *   PUT    /deuda/:deudaId/conciliacion/:periodo/items   marca / desmarca conciliados
 *   POST   /deuda/:deudaId/conciliacion/:periodo/pdf     lee el PDF del estado de cuenta
 */
const router = Router();

router.use(authMiddleware);

router.get('/', consumos.lista);
router.get('/deuda/:deudaId', validate(deudaParamsSchema, 'params'), validate(panelQuerySchema, 'query'), consumos.panel);
router.get('/deuda/:deudaId/simular', validate(deudaParamsSchema, 'params'), validate(simularQuerySchema, 'query'), consumos.simular);
router.post('/deuda/:deudaId/consumos', validate(deudaParamsSchema, 'params'), validate(consumoSchema), consumos.crearConsumo);
router.delete('/deuda/:deudaId/consumos/:consumoId', validate(consumoParamsSchema, 'params'), consumos.eliminarConsumo);
router.put('/deuda/:deudaId/conciliacion/:periodo', validate(periodoParamsSchema, 'params'), validate(conciliacionSchema), consumos.conciliacion);
router.put('/deuda/:deudaId/conciliacion/:periodo/items', validate(periodoParamsSchema, 'params'), validate(itemsSchema), consumos.items);
router.post('/deuda/:deudaId/conciliacion/:periodo/pdf', validate(periodoParamsSchema, 'params'), validate(pdfSchema), consumos.pdf);

export default router;
