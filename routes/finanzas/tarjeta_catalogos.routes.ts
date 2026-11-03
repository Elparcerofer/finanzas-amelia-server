import { Router } from 'express';
import * as controller from '../../controllers/finanzas/tarjeta_catalogos.controller';

/**
 * Catálogos globales de solo lectura para los combos de "Registrar
 * tarjeta" — igual que /entidades, no dependen del usuario.
 */
export const marcasTarjetaRoutes = Router().get('/', controller.listarMarcas);
export const categoriasTarjetaRoutes = Router().get('/', controller.listarCategorias);
