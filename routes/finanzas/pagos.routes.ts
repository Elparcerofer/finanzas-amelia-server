import { Router } from 'express';
import * as pagos from '../../controllers/finanzas/pagos.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  anularPagoSchema,
  deudaIdParamsSchema,
  idParamsSchema,
  registrarPagoSchema,
  simularAbonoSchema,
} from '../../schema/finanzas/pagos.schema';

/**
 * /api/finanzas/pagos
 *   GET  /pendientes                         lista "Registrar pago"
 *   GET  /historial                          pagos registrados
 *   GET  /opciones                           medios, cargos, relaciones
 *   GET  /deuda/:deudaId                     "Detalle de pago" de una deuda
 *   GET  /deuda/:deudaId/simular-abono       abono a capital (?monto=&modo=)
 *   POST /                                   registra cuota/abono/liquidación
 *   POST /:id/anular                         anula el último pago de la deuda
 */
const router = Router();

router.use(authMiddleware);

router.get('/pendientes', pagos.pendientes);
router.get('/historial', pagos.historial);
router.get('/opciones', pagos.opciones);
router.get('/deuda/:deudaId', validate(deudaIdParamsSchema, 'params'), pagos.detalleDeuda);
router.get(
  '/deuda/:deudaId/simular-abono',
  validate(deudaIdParamsSchema, 'params'),
  validate(simularAbonoSchema, 'query'),
  pagos.simularAbono,
);
router.post('/', validate(registrarPagoSchema), pagos.registrar);
router.post('/:id/anular', validate(idParamsSchema, 'params'), validate(anularPagoSchema), pagos.anular);

export default router;
