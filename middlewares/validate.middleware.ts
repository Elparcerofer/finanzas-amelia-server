import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';

type Fuente = 'body' | 'params' | 'query';

export function validate(schema: ObjectSchema, fuente: Fuente = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[fuente], { abortEarly: false, stripUnknown: true });

    if (error) {
      res.status(400).json({
        msg: error.details.map((d) => d.message).join('; '),
      });
      return;
    }

    req[fuente] = value;
    next();
  };
}
