import Joi from 'joi';

export const perfilSchema = Joi.object({
  nombreCompleto: Joi.string().trim().min(2).max(256).required(),
  cedula: Joi.string().pattern(/^\d{10}$/).allow(null, '').messages({ 'string.pattern.base': 'La cédula debe tener 10 dígitos' }),
  correo: Joi.string().email({ tlds: { allow: false } }).max(256).allow(null, ''),
  telefono: Joi.string().max(20).allow(null, ''),
  ingresoMensual: Joi.number().min(0).allow(null),
});

const bool = Joi.boolean();

export const preferenciasSchema = Joi.object({
  canalCorreo: bool,
  canalPush: bool,
  canalWhatsapp: bool,
  canalSms: bool,
  alertaVencimiento: bool,
  avisoCupoAlto: bool,
  tipsSemanales: bool,
  resumenSemanal: bool,
  logosAutomaticos: bool,
}).min(1);
