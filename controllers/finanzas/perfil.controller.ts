import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { editarPerfil, obtenerPerfil, registrarPerfil } from '../../services/finanzas/perfil.service';

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perfil = await obtenerPerfil(req.usuario!.id);
    res.json(perfil);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perfil = await registrarPerfil(req.usuario!.id, req.body);
    res.status(201).json(perfil);
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perfil = await editarPerfil(req.usuario!.id, req.body);
    res.json(perfil);
  } catch (error) {
    next(error);
  }
}
