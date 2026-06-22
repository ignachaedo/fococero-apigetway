/**
 * @fileoverview Middleware de trazabilidad (Trace ID) para el API Gateway.
 * Genera o propaga un identificador único por request (x-trace-id) que
 * se inyecta tanto en headers de salida como en la request hacia microservicios.
 * Valida IDs entrantes contra un patrón seguro para evitar inyección.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/** Regex de seguridad: solo UUIDs o alfanuméricos de 10-50 caracteres */
const safeIdRegex = /^[a-zA-Z0-9-]{10,50}$/;

/**
 * Middleware que asegura que cada request tenga un x-trace-id.
 * Si el cliente envía uno válido, lo propaga; si no, genera un UUIDv4.
 * Inyecta el trace ID en los headers de respuesta y en req.headers para
 * los microservicios aguas abajo.
 *
 * @param req - Objeto de solicitud Express
 * @param res - Objeto de respuesta Express
 * @param next - Función next de Express
 */
export const traceIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingId = req.headers["x-trace-id"] as string;

  // Si envían un ID malicioso o inexistente, generamos un UUIDv4 limpio
  const traceId =
    incomingId && safeIdRegex.test(incomingId) ? incomingId : randomUUID();

  // Inyectamos el rastro seguro hacia adelante (microservicios) y hacia atrás (frontend)
  req.headers["x-trace-id"] = traceId;
  res.setHeader("x-trace-id", traceId);

  next();
};
