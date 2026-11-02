import Joi from 'joi';

const TIPOS_CUENTA = ['ahorros', 'corriente', 'tarjetaDebito', 'billeteraDigital', 'efectivo'];
const PROPIEDADES = ['propia', 'deTercero'];

export const guardarCuentaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  alias: Joi.string().min(1).max(100).required(),
  tipoCuenta: Joi.string().valid(...TIPOS_CUENTA).required(),
  entidadId: Joi.alternatives(Joi.string(), Joi.number()).allow(null, '').optional(),
  ultimos4: Joi.string().max(4).allow(null, '').optional(),
  titular: Joi.string().max(100).allow(null, '').optional(),
  propiedad: Joi.string().valid(...PROPIEDADES).optional(),
  relacion: Joi.string().max(60).allow(null, '').optional(),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
