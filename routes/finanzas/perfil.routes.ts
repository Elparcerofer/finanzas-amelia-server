import { Router } from 'express';
import * as perfilController from '../../controllers/finanzas/perfil.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { actualizarPerfilSchema, crearPerfilSchema } from '../../schema/finanzas/perfil.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', perfilController.obtener);
router.post('/', validate(crearPerfilSchema), perfilController.crear);
router.put('/', validate(actualizarPerfilSchema), perfilController.actualizar);

export default router;
