import { NextFunction, Request, Response } from 'express';
import {
  borrarEntidad,
  editarEntidad,
  obtenerEntidad,
  obtenerEntidades,
  registrarEntidad,
} from '../../services/finanzas/entidades.service';

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerEntidades());
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerEntidad(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarEntidad(req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarEntidad(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarEntidad(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
