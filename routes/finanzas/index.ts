import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
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
import usosRoutes from './usos.routes';
import { categoriasTarjetaRoutes, marcasTarjetaRoutes } from './tarjeta_catalogos.routes';

const router = Router();

// Todo Finanzas exige la sesión de Amelia (x-token), incluidos los
// catálogos globales: nadie sin sesión puede leer ni crear entidades,
// empresas o categorías.
router.use(authMiddleware);

// Rutas con endpoints reales, consumidas hoy por las pantallas de Flutter
// (ver AppConstants.URL_FINANZAS_* en config/constants.dart).
router.use('/categorias', categoriasRoutes);
router.use('/entidades', entidadesRoutes);
router.use('/empresas', empresasRoutes);
router.use('/cuentas', cuentasRoutes);
router.use('/tarjetas', tarjetasRoutes);
router.use('/marcas-tarjeta', marcasTarjetaRoutes);
router.use('/categorias-tarjeta', categoriasTarjetaRoutes);
router.use('/deudas', deudasRoutes);
router.use('/usos', usosRoutes);

// Placeholders: sin pantalla de Flutter conectada todavía.
router.use('/pagos', pagosRoutes);
router.use('/ingresos', ingresosRoutes);
router.use('/reporteria', reporteriaRoutes);
router.use('/calendario', calendarioRoutes);
router.use('/asesor', asesorRoutes);
router.use('/perfil', perfilRoutes);

export default router;
