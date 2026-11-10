import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { actualizarPerfil, actualizarPreferencias, perfilCompleto, respaldo } from '../../services/finanzas/perfil.service';

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const manejar = (h: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => h(req, res).catch(next);

export const obtener = manejar(async (req, res) => {
  res.json(await perfilCompleto(req.usuario!.id));
});

export const actualizar = manejar(async (req, res) => {
  res.json(await actualizarPerfil(req.usuario!.id, req.body));
});

export const preferencias = manejar(async (req, res) => {
  res.json(await actualizarPreferencias(req.usuario!.id, req.body));
});

export const exportar = manejar(async (req, res) => {
  res.json(await respaldo(req.usuario!.id));
});
