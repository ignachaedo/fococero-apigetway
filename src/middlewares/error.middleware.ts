/**
 * @fileoverview Middleware global de manejo de errores para el API Gateway.
 * Captura todas las excepciones no manejadas y retorna respuestas estandarizadas
 * con código de estado HTTP. Oculta detalles de errores internos en producción.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Middleware de manejo global de errores.
 * Responde con errores operativos tal cual y oculta errores no operativos en producción.
 *
 * @param err - Error lanzado (puede incluir statusCode e isOperational)
 * @param req - Objeto de solicitud Express
 * @param res - Objeto de respuesta Express
 * @param next - Función next de Express
 */
export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';
  
  if (!err.isOperational) {
    logger.error({ err }, '[ERROR] Unexpected error:');
  }
  
  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
