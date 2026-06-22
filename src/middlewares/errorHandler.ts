/**
 * @fileoverview Manejador global de errores para el API Gateway.
 * Captura cualquier excepción no controlada en el pipeline de middleware
 * y retorna una respuesta estandarizada de error al cliente.
 * Express requiere exactamente 4 argumentos para identificar este middleware.
 */

import { Request, Response, NextFunction } from "express";
import { envs } from "../config/envs";
import { logger } from "../config/logger";

/**
 * Middleware global de manejo de errores para el API Gateway.
 *
 * @description Captura errores lanzados desde cualquier middleware anterior,
 * sanitiza la URL antes de loguearla (previene inyección en logs), y responde
 * con un mensaje genérico sin exponer detalles internos del servidor.
 * Los errores se asocian a un Trace ID para facilitar la depuración distribuida.
 *
 * @param err - Objeto de error capturado (puede contener statusCode propio)
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param _next - Función NextFunction (no utilizada, requerida por firma de Express)
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // Express requiere que existan los 4 argumentos para identificarlo como Error Middleware
  _next: NextFunction,
) => {
  const statusCode = err.status || err.statusCode || 500;

  // 🛡️ Escudo: Sanitizamos la URL antes de imprimirla para evitar inyección de logs
  const safeUrl = encodeURI(req.originalUrl);
  const traceId = req.headers["x-trace-id"] || "N/A";

  // Log interno con Trace ID para depuración rápida
  logger.error(
    `❌ [Gateway Error | Trace: ${traceId}] ${req.method} ${safeUrl} - ${err.message}`,
  );

  res.status(statusCode).json({
    ok: false,
    error: "Error de comunicación en la red perimetral (Gateway)",
    traceId: traceId,
  });
};
