import { NextFunction, Request, Response } from 'express';
import {
  borrarCategoria,
  editarCategoria,
  obtenerCategoria,
  obtenerCategorias,
  registrarCategoria,
} from '../../services/finanzas/categorias.service';

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerCategorias());
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerCategoria(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarCategoria(req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarCategoria(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarCategoria(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
