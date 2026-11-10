import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  editarIngreso,
  fuentesIngreso,
  registrarIngreso,
  removerIngreso,
  resumenIngresos,
} from '../../services/finanzas/ingresos.service';

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const manejar = (h: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => h(req, res).catch(next);

export const resumen = manejar(async (req, res) => {
  res.json(await resumenIngresos(req.usuario!.id));
});

export const fuentes = manejar(async (_req, res) => {
  res.json(await fuentesIngreso());
});

export const crear = manejar(async (req, res) => {
  res.status(201).json(await registrarIngreso(req.usuario!.id, req.body));
});

export const actualizar = manejar(async (req, res) => {
  res.json(await editarIngreso(req.usuario!.id, Number(req.params.id), req.body));
});

export const eliminar = manejar(async (req, res) => {
  await removerIngreso(req.usuario!.id, Number(req.params.id));
  res.status(204).send();
});
