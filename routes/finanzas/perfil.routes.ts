import { Router } from 'express';
import * as perfil from '../../controllers/finanzas/perfil.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { perfilSchema, preferenciasSchema } from '../../schema/finanzas/perfil.schema';

/**
 * /api/finanzas/perfil
 *   GET  /               perfil, salud, deudas y preferencias
 *   PUT  /               datos personales (crea el perfil si no existe)
 *   PUT  /preferencias   canales de aviso, alertas y logos automáticos
 *   GET  /respaldo       exporta los datos del usuario (JSON)
 */
const router = Router();

router.use(authMiddleware);

router.get('/', perfil.obtener);
router.put('/', validate(perfilSchema), perfil.actualizar);
router.put('/preferencias', validate(preferenciasSchema), perfil.preferencias);
router.get('/respaldo', perfil.exportar);

export default router;
