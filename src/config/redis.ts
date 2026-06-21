import { createClient, RedisClientType } from "redis";
import { envs } from "./envs";
import { logger } from "./logger";

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (!redisClient) {
        redisClient = createClient({
            url: envs.REDIS_URL,
            socket: {
                connectTimeout: 3000,
                reconnectStrategy: (retries: number) => {
                    if (retries > 10) {
                        logger.error("[Redis] Max reconnect attempts reached");
                        return new Error("Max reconnect attempts");
                    }
                    const delay = Math.min(retries * 100, 3000);
                    logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
                    return delay;
                },
            },
        });

        redisClient.on("error", (err: Error) => {
            logger.warn("[Redis] Client error: " + err.message);
        });

        redisClient.on("end", () => {
            logger.warn("[Redis] Connection closed");
        });

        async function connectRedis(): Promise<void> {
            try {
                await redisClient!.connect();
                logger.info("[Redis] Connected");
            } catch (error) {
                logger.warn("[Redis] Connection failed, rate limiting degraded: " + (error as Error).message);
            }
        }

        await connectRedis();
    }
    return redisClient;
}

export async function closeRedis(): Promise<void> {
    try {
        if (redisClient?.isOpen) {
            await redisClient.quit();
            redisClient = null;
            logger.info("[Redis] Connection closed");
        }
    } catch (error) {
        logger.warn("[Redis] Error closing connection: " + (error as Error).message);
    }
}
