import Joi from 'joi';

export const crearIngresoSchema = Joi.object({
  monto: Joi.number().positive().required(),
  fuente: Joi.string().min(2).max(120).required(),
  fecha: Joi.date().required(),
  periodicidad: Joi.string().valid('mensual', 'quincenal', 'semanal', 'unico').required(),
});

export const actualizarIngresoSchema = Joi.object({
  monto: Joi.number().positive().optional(),
  fuente: Joi.string().min(2).max(120).optional(),
  fecha: Joi.date().optional(),
  periodicidad: Joi.string().valid('mensual', 'quincenal', 'semanal', 'unico').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
