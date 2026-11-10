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
  // Mismos límites que los CHECK de tablas_amortizacion.
  tasaAnual: Joi.number().min(0).max(100).required(),
  plazoMeses: Joi.number().integer().min(1).max(480).required(),
  fechaInicio: Joi.date().iso().required(),
  tipoCuota: Joi.string().valid('fija', 'variable').optional(),
  segDesgravamenTipo: Joi.string().valid('fijo', 'porcentaje').optional(),
  segDesgravamenValor: Joi.number().min(0).optional(),
  otrosSeguros: Joi.number().min(0).optional(),
  origen: Joi.string().valid('generada', 'subida').optional(),
});

const consumoTarjetaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).allow(null).optional(),
  fecha: Joi.date().iso().required(),
  comercio: Joi.string().trim().min(1).max(150).required()
    .messages({ 'string.empty': 'Cada consumo necesita el comercio o detalle' }),
  // Obligatoria: consumos_tarjeta.categoria_id es NOT NULL.
  categoriaId: Joi.alternatives(Joi.string().pattern(/^\d+$/), Joi.number().integer().positive()).required()
    .messages({ 'any.required': 'Cada consumo necesita una categoría' }),
  categoriaNombre: Joi.string().allow(null, '').optional(),
  monto: Joi.number().positive().required()
    .messages({ 'number.positive': 'El monto de cada consumo debe ser mayor a 0' }),
  modalidad: Joi.string().valid('corriente', 'dif_con', 'dif_sin').required(),
  plazo: Joi.number().integer().min(1).max(48).optional(),
  mesesGracia: Joi.number().integer().min(0).max(12).optional(),
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
  resumen: resumenSchema.when('modo', { is: 'resumida', then: Joi.required(), otherwise: Joi.allow(null).optional() }),
  // Detallada: los préstamos llevan tabla de amortización y la tarjeta
  // lleva consumos (el servicio exige cada caso con un mensaje claro).
  parametrosAmortizacion: parametrosAmortizacionSchema.allow(null).optional(),
  tablaAmortizacion: Joi.array().items(cuotaAmortizacionSchema).max(480).allow(null).optional(),
  consumos: Joi.array().items(consumoTarjetaSchema).max(500).allow(null).optional(),
  pagaCon: Joi.string().pattern(/^[cte]:\d+$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'Forma de pago no válida' }),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
