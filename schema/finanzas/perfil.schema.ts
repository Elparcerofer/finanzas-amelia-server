import Joi from 'joi';

export const crearPerfilSchema = Joi.object({
  nombres: Joi.string().min(2).max(100).required(),
  apellidos: Joi.string().min(2).max(100).required(),
  cedula: Joi.string().length(10).pattern(/^\d+$/).required(),
  telefono: Joi.string().max(15).optional(),
  ingreso_mensual_estimado: Joi.number().min(0).optional(),
});

export const actualizarPerfilSchema = Joi.object({
  nombres: Joi.string().min(2).max(100).optional(),
  apellidos: Joi.string().min(2).max(100).optional(),
  telefono: Joi.string().max(15).optional(),
  ingreso_mensual_estimado: Joi.number().min(0).optional(),
});
