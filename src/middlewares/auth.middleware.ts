/**
 * @fileoverview Middleware de autenticación para API Gateway.
 * Verifica tokens JWT de Firebase en las peticiones entrantes,
 * inyecta datos del usuario autenticado en los headers para
 * los microservicios internos, y aplica bypass para rutas públicas.
 */

import { Request, Response, NextFunction } from "express";
import admin from "../config/firebase";
import { logger } from "../config/logger";

/**
 * 🛡️ BYPASS PATHS: Rutas que NO requieren autenticación.
 * Estas rutas son públicas y el middleware las salta automáticamente.
 * Incluye endpoints de login, registro y callbacks de OAuth (Google, etc.).
 */
const bypassPaths = [
  "/api/auth/login",
  "/api/auth/register-guest",
  "/api/auth/register-full",
  "/api/auth/google",
  "/api/alertas/publicas",
];

/**
 * Middleware que verifica el token JWT de Firebase en el header Authorization.
 *
 * @description Valida la firma criptográfica del token usando Firebase Admin SDK,
 * limpia headers de spoofing, y propaga la identidad del usuario a los microservicios
 * mediante headers estandarizados (x-user-id, x-user-email, x-user-role).
 * Las rutas definidas en `bypassPaths` se saltan la verificación.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 * @returns Promise<void> - No retorna valor, pasa al siguiente middleware o responde con 401
 * @throws Error - Errores de Firebase (token expirado, inválido) capturados y respondidos como 401
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // 🛡️ PREVENCIÓN DE SPOOFING: Limpiamos cualquier cabecera maliciosa que intente hacerse pasar por el Gateway
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];
  delete req.headers["x-user-role"];

  // 🔓 Bypass para rutas públicas (defense-in-depth si el middleware se aplica globalmente)
  const requestPath = req.originalUrl.split("?")[0];
  if (bypassPaths.includes(requestPath)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      ok: false,
      error:
        "🚨 Acceso Denegado: Credenciales de acceso no proporcionadas o formato inválido.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // 🔐 Verificación criptográfica real con Firebase
    // checkRevoked=true: Rechaza tokens revocados (cierre de sesión, admin deshabilitó cuenta)
    const decodedToken = await admin.auth().verifyIdToken(token, true);

    // Inyectamos los datos validados de forma segura para los microservicios
    req.headers["x-user-id"] = decodedToken.uid;

    if (decodedToken.email) {
      req.headers["x-user-email"] = decodedToken.email;
    }

    // Si usas custom claims en Firebase para los roles:
    if (decodedToken.role) {
      req.headers["x-user-role"] = decodedToken.role as string;
    }

    next();
  } catch (error: any) {
    // 🛡️ Protección contra TypeError: Firebase puede lanzar errores sin propiedad `code`
    const isExpired = error?.code === "auth/id-token-expired";

    logger.warn(
      `[Auth Middleware] Token inválido${isExpired ? " (expirado)" : ""}`,
    );

    res.status(401).json({
      ok: false,
      error: isExpired
        ? "🚨 Acceso Denegado: Su sesión ha expirado."
        : "🚨 Acceso Denegado: Token inválido o corrupto.",
    });
  }
};
