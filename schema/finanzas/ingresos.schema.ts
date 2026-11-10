import Joi from 'joi';

export const guardarIngresoSchema = Joi.object({
  fuente: Joi.string().max(20).required(),
  monto: Joi.number().positive().precision(2).required(),
  fecha: Joi.date().iso().required(),
  periodicidad: Joi.string().valid('mensual', 'unico').required(),
  hasta: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).allow(null, ''),
  cuentaId: Joi.number().integer().positive().allow(null),
  descripcion: Joi.string().max(255).allow(null, ''),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
