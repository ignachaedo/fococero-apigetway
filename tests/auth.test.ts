/**
 * Pruebas unitarias del Middleware de Autenticación del API Gateway
 * 
 * @module auth
 */

// Mock de firebase-admin ANTES de cualquier importación
jest.mock('firebase-admin');

import request from 'supertest';
import app from '../src/app';

describe('API Gateway - Middleware de Autenticación', () => {
  it('debería rechazar petición sin token en rutas protegidas', async () => {
    const res = await request(app).get('/api/emergencias');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('ok', false);
    expect(res.status).not.toBe(200);
  });

  it('debería rechazar petición con token inválido en rutas protegidas', async () => {
    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('ok', false);
    expect(res.status).not.toBe(200);
  });

  it('debería rechazar petición sin token en la ruta analitica', async () => {
    const res = await request(app).get('/api/analitica/dashboard');
    expect(res.status).toBe(401);
  });

  it('debería rechazar petición con cabecera auth malformada', async () => {
    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'NotBearer token');
    expect(res.status).toBe(401);
  });

  it('debería rechazar petición con token vacío', async () => {
    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('debería permitir rutas públicas sin autenticación', async () => {
    const res = await request(app).get('/api/auth/health');
    // /api/auth NO tiene el middleware verifyToken — debería intentar el proxy
    // Como el destino está inalcanzable, retorna 502, no 401
    expect(res.status).toBe(502);
    expect(res.status).not.toBe(401);
  });
});
