import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  agregarConsumo,
  conciliarItems,
  guardarConciliacion,
  leerPdfEstadoCuenta,
  listarDeudas,
  panelDeuda,
  quitarConsumo,
  simularAbonoPrestamo,
} from '../../services/finanzas/consumos.service';

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const manejar = (h: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => h(req, res).catch(next);
const deuda = (req: AuthRequest) => Number(req.params.deudaId);

export const lista = manejar(async (req, res) => {
  res.json(await listarDeudas(req.usuario!.id));
});

export const panel = manejar(async (req, res) => {
  res.json(await panelDeuda(req.usuario!.id, deuda(req), req.query.periodo as string | undefined));
});

export const simular = manejar(async (req, res) => {
  res.json(await simularAbonoPrestamo(req.usuario!.id, deuda(req), Number(req.query.monto), Number(req.query.despues)));
});

export const crearConsumo = manejar(async (req, res) => {
  await agregarConsumo(req.usuario!.id, deuda(req), req.body);
  res.status(201).json({ ok: true });
});

export const eliminarConsumo = manejar(async (req, res) => {
  await quitarConsumo(req.usuario!.id, deuda(req), Number(req.params.consumoId));
  res.status(204).send();
});

export const conciliacion = manejar(async (req, res) => {
  await guardarConciliacion(req.usuario!.id, deuda(req), req.params.periodo, req.body);
  res.json({ ok: true });
});

export const items = manejar(async (req, res) => {
  await conciliarItems(req.usuario!.id, deuda(req), req.params.periodo, req.body.claves, req.body.conciliado);
  res.json({ ok: true });
});

export const pdf = manejar(async (req, res) => {
  const { nombre, base64, clave } = req.body;
  res.json(await leerPdfEstadoCuenta(req.usuario!.id, deuda(req), req.params.periodo, nombre, base64, clave));
});
