/**
 * Pruebas unitarias para el Proxy del API Gateway
 * 
 * @module proxy
 */
import request from 'supertest';
import app from '../src/app';

describe('API Gateway - Proxy', () => {
  it('debería retornar 502 para servicio proxy inalcanzable en /api/auth', async () => {
    // /api/auth no requiere verifyToken, por lo que el proxy intentará
    // conectarse a AUTH_SERVICE_URL (localhost:3001) y fallará con 502
    const res = await request(app).get('/api/auth/test');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('ok', false);
    expect(res.status).not.toBe(200);
  });

  it('debería retornar 404 para rutas desconocidas', async () => {
    const res = await request(app).get('/api/nonexistent');
    // Las rutas que no coinciden con ningún proxy o ruta caen en Express 404
    expect(res.status).toBe(404);
  });
});
