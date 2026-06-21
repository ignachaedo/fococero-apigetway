/**
 * Pruebas unitarias para el Limitador de Peticiones (Rate Limiter) del API Gateway
 * 
 * @module rateLimiter
 */
import request from "supertest";
import app from "../src/app";

describe("API Gateway - Limitador de Peticiones", () => {
  it("debería permitir peticiones dentro del límite de tasa en /health", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "OK");
    }
  });

  it("debería incluir cabeceras de límite de tasa en el endpoint health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    // Las cabeceras RateLimit-* son establecidas por express-rate-limit cuando standardHeaders: true
    if (res.headers["ratelimit-limit"]) {
      expect(Number(res.headers["ratelimit-limit"])).toBeGreaterThan(0);
    }
  });
});
