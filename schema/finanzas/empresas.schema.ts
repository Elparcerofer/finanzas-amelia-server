import Joi from 'joi';

export const guardarEmpresaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  nombre: Joi.string().min(1).max(120).required(),
  rubro: Joi.string().max(80).allow(null, '').optional(),
  cobertura: Joi.string().max(120).allow(null, '').optional(),
  telefono: Joi.string().max(20).allow(null, '').optional(),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
