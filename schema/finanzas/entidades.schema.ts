import Joi from 'joi';
import { logoSchema, webSchema } from '../../utils/finanzas/logo_web';
import { TIPOS_ENTIDAD } from '../../models/finanzas/entidad_financiera.model';

export const guardarEntidadSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  nombre: Joi.string().min(1).max(120).required(),
  tipo: Joi.string().valid(...TIPOS_ENTIDAD).required(),
  codigo: Joi.string().trim().uppercase().max(20).pattern(/^[A-Z0-9_-]+$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'El código solo admite letras, números, guion y guion bajo' }),
  ruc: Joi.string().trim().pattern(/^\d{13}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'El RUC debe tener 13 dígitos' }),
  pais: Joi.string().max(60).allow(null, '').optional(),
  telefono: Joi.string().max(20).allow(null, '').optional(),
  web: webSchema,
  logo: logoSchema,
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
