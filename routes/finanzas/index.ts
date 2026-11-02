import { Router } from 'express';
import categoriasRoutes from './categorias.routes';
import entidadesRoutes from './entidades.routes';
import empresasRoutes from './empresas.routes';
import cuentasRoutes from './cuentas.routes';
import tarjetasRoutes from './tarjetas.routes';
import deudasRoutes from './deudas.routes';
import pagosRoutes from './pagos.routes';
import ingresosRoutes from './ingresos.routes';
import reporteriaRoutes from './reporteria.routes';
import calendarioRoutes from './calendario.routes';
import asesorRoutes from './asesor.routes';
import perfilRoutes from './perfil.routes';

const router = Router();

// Rutas con endpoints reales, consumidas hoy por las pantallas de Flutter
// (ver AppConstants.URL_FINANZAS_* en config/constants.dart).
router.use('/categorias', categoriasRoutes);
router.use('/entidades', entidadesRoutes);
router.use('/empresas', empresasRoutes);
router.use('/cuentas', cuentasRoutes);
router.use('/tarjetas', tarjetasRoutes);
router.use('/deudas', deudasRoutes);

// Placeholders: sin pantalla de Flutter conectada todavía.
router.use('/pagos', pagosRoutes);
router.use('/ingresos', ingresosRoutes);
router.use('/reporteria', reporteriaRoutes);
router.use('/calendario', calendarioRoutes);
router.use('/asesor', asesorRoutes);
router.use('/perfil', perfilRoutes);

export default router;
