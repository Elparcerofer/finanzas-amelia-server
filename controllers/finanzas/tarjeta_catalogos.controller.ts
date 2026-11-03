import { NextFunction, Request, Response } from 'express';
import { listarCategoriasTarjeta, listarMarcasTarjeta } from '../../models/finanzas/tarjeta_catalogos.model';

export async function listarMarcas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await listarMarcasTarjeta());
  } catch (error) {
    next(error);
  }
}

export async function listarCategorias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await listarCategoriasTarjeta());
  } catch (error) {
    next(error);
  }
}
