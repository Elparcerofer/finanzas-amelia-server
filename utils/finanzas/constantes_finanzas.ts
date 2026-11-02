export const TIPOS_CATALOGO = {
  BANCO: 'banco',
  EMPRESA: 'empresa',
  CATEGORIA: 'categoria',
} as const;

export const ESTADOS_DEUDA = {
  PENDIENTE: 'pendiente',
  AL_DIA: 'al_dia',
  VENCIDA: 'vencida',
  PAGADA: 'pagada',
} as const;

export const METODOS_PAGO = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
  DEBITO_AUTOMATICO: 'debito_automatico',
} as const;

export const TIPOS_EVENTO_CALENDARIO = {
  PAGO: 'pago',
  INGRESO: 'ingreso',
  RECORDATORIO: 'recordatorio',
} as const;

export const CANALES_NOTIFICACION = {
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export const PERIODICIDAD_INGRESO = {
  MENSUAL: 'mensual',
  QUINCENAL: 'quincenal',
  SEMANAL: 'semanal',
  UNICO: 'unico',
} as const;

export const CAPACIDAD_PAGO_MAX_RATIO_DEUDA_INGRESO = 0.4;
