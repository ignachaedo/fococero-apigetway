/**
 * @fileoverview Middleware de rate limiting basado en Redis.
 * Limita el número de peticiones por usuario autenticado (x-user-id)
 * o por dirección IP (para usuarios anónimos) usando ventanas deslizantes.
 * Incluye reintento automático de conexión a Redis con backoff.
 */

import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis";
import { logger } from "../config/logger";

/** Duración de la ventana de rate limiting en milisegundos (15 minutos) */
const WINDOW_MS = 15 * 60 * 1000;
/** Duración de la ventana en segundos para Redis TTL */
const WINDOW_SECS = Math.floor(WINDOW_MS / 1000);
/** Cantidad máxima de requests permitidos por ventana */
const MAX_REQUESTS = 200;
/** Intervalo entre reintentos de conexión a Redis (30 segundos) */
const REDIS_RETRY_INTERVAL = 30000;

let redisOk = false;
let redisChecked = false;
let lastRedisCheck = 0;

if (process.env.NODE_ENV === "test") {
    redisChecked = true;
    redisOk = false;
}

/**
 * Middleware de rate limiting por usuario (UID) o IP.
 *
 * @description Limita a MAX_REQUESTS (200) peticiones por ventana de 15 minutos.
 * Usa el header x-user-id como clave si el usuario está autenticado,
 * o la dirección IP como fallback. Incluye degradación graceful si Redis no está disponible.
 * Establece headers estándar de rate limiting (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset).
 * Salta la verificación para la ruta /health.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 * @returns Promise<void> - No retorna valor, pasa al siguiente middleware o responde 429
 */
export const rateLimiterByUID = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    if (req.path === "/health") {
        return next();
    }

    if (Date.now() - lastRedisCheck > REDIS_RETRY_INTERVAL) {
        redisChecked = false;
    }

    if (!redisChecked) {
        try {
            await getRedisClient();
            redisOk = true;
        } catch {
            redisOk = false;
        }
        redisChecked = true;
        lastRedisCheck = Date.now();
    }

    if (!redisOk) {
        return next();
    }

    try {
        const userId = req.headers["x-user-id"] as string | undefined;
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const key = userId
            ? `ratelimit:uid:${userId}`
            : `ratelimit:ip:${ip}`;

        const redis = await getRedisClient();

        if (!redis.isOpen) {
            logger.warn("[RateLimiter] Redis not connected, allowing request");
            return next();
        }

        const current = await redis.incr(key);

        if (current === 1) {
            await redis.expire(key, WINDOW_SECS);
        }

        res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, MAX_REQUESTS - current));
        res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + WINDOW_MS) / 1000));

        if (current > MAX_REQUESTS) {
            res.status(429).json({
                ok: false,
                message: "Demasiadas peticiones. Intenta de nuevo en 15 minutos.",
            });
            return;
        }

        next();
    } catch (error) {
        logger.warn("[RateLimiter] Error: " + (error as Error).message);
        return next();
    }
};
