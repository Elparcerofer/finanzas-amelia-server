import Joi from 'joi';

const TIPOS_CREDITO = ['tarjeta', 'consumo', 'capital', 'vehicular', 'hipotecario', 'garantia', 'empresarial', 'suscripcion'];

const resumenSchema = Joi.object({
  valor: Joi.number().required(),
  fecha: Joi.date().iso().required(),
  minimo: Joi.number().allow(null).optional(),
  corte: Joi.date().iso().allow(null).optional(),
  saldo: Joi.number().allow(null).optional(),
  restantesCuotas: Joi.number().integer().allow(null).optional(),
  tasaAnual: Joi.number().allow(null).optional(),
  nota: Joi.string().max(255).allow(null, '').optional(),
});

const parametrosAmortizacionSchema = Joi.object({
  monto: Joi.number().positive().required(),
  tasaAnual: Joi.number().min(0).required(),
  plazoMeses: Joi.number().integer().positive().required(),
  fechaInicio: Joi.date().iso().required(),
  tipoCuota: Joi.string().valid('fija', 'variable').optional(),
  segDesgravamenTipo: Joi.string().valid('fijo', 'porcentaje').optional(),
  segDesgravamenValor: Joi.number().min(0).optional(),
  otrosSeguros: Joi.number().min(0).optional(),
});

const cuotaAmortizacionSchema = Joi.object({
  numero: Joi.number().integer().positive().required(),
  fecha: Joi.date().iso().required(),
  capital: Joi.number().required(),
  interes: Joi.number().required(),
  seguro: Joi.number().required(),
  cuota: Joi.number().required(),
  saldo: Joi.number().required(),
});

export const guardarDeudaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  tipo: Joi.string().valid(...TIPOS_CREDITO).required(),
  modo: Joi.string().valid('resumida', 'detallada').required(),
  fuenteAcreedorId: Joi.alternatives(Joi.string(), Joi.number()).required(),
  alias: Joi.string().max(150).allow(null, '').optional(),
  avisoDias: Joi.number().integer().valid(1, 3, 5).optional(),
  categoriaId: Joi.alternatives(Joi.string(), Joi.number()).allow(null, '').optional(),
  resumen: resumenSchema.when('modo', { is: 'resumida', then: Joi.required(), otherwise: Joi.optional() }),
  parametrosAmortizacion: parametrosAmortizacionSchema.when('modo', { is: 'detallada', then: Joi.required(), otherwise: Joi.optional() }),
  tablaAmortizacion: Joi.array().items(cuotaAmortizacionSchema).optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
