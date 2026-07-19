import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../lib/errors';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada.' });
}

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: 'El archivo es demasiado grande (máx. 50MB).',
  LIMIT_FILE_COUNT: 'Puedes subir hasta 10 archivos a la vez.',
  LIMIT_UNEXPECTED_FILE: 'Demasiados archivos, o un campo de archivo inesperado.',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // Errores propios de Multer (límite de tamaño, demasiados archivos, etc.)
  // — sin este caso, caían en el 500 genérico de abajo y el usuario nunca
  // se enteraba de por qué falló la subida.
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: MULTER_ERROR_MESSAGES[err.code] ?? 'No se pudo subir el archivo.' });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Nunca exponer detalles internos/stack traces al cliente.
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.' });
}
