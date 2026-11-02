import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { obtenerEventosDeUsuario, registrarEvento, removerEvento } from '../../services/finanzas/calendario.service';

export async function listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };
    const eventos = await obtenerEventosDeUsuario(req.usuario!.id, desde, hasta);
    res.json(eventos);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const evento = await registrarEvento(req.usuario!.id, req.body);
    res.status(201).json(evento);
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await removerEvento(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
