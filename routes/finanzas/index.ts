import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as sesionController from '../../controllers/finanzas/sesion.controller';
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
import inicioRoutes from './inicio.routes';
import consumosRoutes from './consumos.routes';
import asesorRoutes from './asesor.routes';
import perfilRoutes from './perfil.routes';
import usosRoutes from './usos.routes';
import { categoriasTarjetaRoutes, marcasTarjetaRoutes } from './tarjeta_catalogos.routes';

const router = Router();

// Canje del token de Amelia por el de Finanzas: va antes del
// authMiddleware porque todavía no hay token de Finanzas.
router.post('/sesion', sesionController.crear);

// Todo lo demás exige el token de Finanzas (Authorization: Bearer),
// incluidos los catálogos globales: nadie sin sesión puede leer ni crear
// entidades, empresas o categorías.
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
router.use('/inicio', inicioRoutes);
router.use('/consumos', consumosRoutes);

router.use('/pagos', pagosRoutes);
router.use('/ingresos', ingresosRoutes);
router.use('/calendario', calendarioRoutes);

// Placeholders: sin pantalla de Flutter conectada todavía.
router.use('/reporteria', reporteriaRoutes);
router.use('/asesor', asesorRoutes);
router.use('/perfil', perfilRoutes);

export default router;
