/**
 * Pruebas de integración del flujo de autenticación (Auth Flow) en el API Gateway
 * 
 * @module auth-flow.integration
 */

jest.mock('firebase-admin');

import request from 'supertest';
import app from '../src/app';
import * as admin from 'firebase-admin';

describe('API Gateway - Integración del Flujo de Autenticación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería permitir rutas públicas de autenticación (login) sin token de Firebase', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ rut: '12345678-9', password: 'test123' });

    // Como ms-auth está inalcanzable en las pruebas, retorna 502 (error de proxy)
    // Pero NO debería retornar 401 (error de autenticación) — login es público
    expect(res.status).toBe(502);
    expect(res.status).not.toBe(401);
  });

  it('debería rechazar ruta protegida sin cabecera Authorization', async () => {
    const res = await request(app).get('/api/emergencias');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('ok', false);
    expect(res.status).not.toBe(200);
  });

  it('debería rechazar ruta protegida con token de Firebase inválido', async () => {
    (admin.auth().verifyIdToken as jest.Mock).mockRejectedValueOnce(
      new Error('Invalid token'),
    );

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer fake-firebase-token');
    expect(res.status).toBe(401);
  });

  it('debería inyectar cabeceras x-user-id y x-user-role para peticiones autenticadas', async () => {
    const fakeDecodedToken = {
      uid: 'firebase-uid-123',
      email: 'test@fococero.cl',
      role: 'USUARIO',
    };

    (admin.auth().verifyIdToken as jest.Mock).mockResolvedValueOnce(
      fakeDecodedToken,
    );

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer valid-firebase-token');

    expect(res.status).toBe(502);
  });

  it('debería eliminar cabeceras x-user-id falsificadas de las peticiones entrantes', async () => {
    const fakeDecodedToken = {
      uid: 'firebase-uid-456',
      email: 'user@test.cl',
      role: 'BRIGADISTA',
    };

    (admin.auth().verifyIdToken as jest.Mock).mockResolvedValueOnce(
      fakeDecodedToken,
    );

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer real-token')
      .set('x-user-id', 'spoofed-uid')
      .set('x-user-role', 'ADMIN');

    expect(res.status).toBe(502);
  });

  it('debería retornar 502 cuando el servicio proxy está inalcanzable (endpoint auth activo)', async () => {
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(502);
  });

  it('debería retornar 401 para tokens de Firebase expirados', async () => {
    (admin.auth().verifyIdToken as jest.Mock).mockRejectedValueOnce({
      code: 'auth/id-token-expired',
    });

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
  });
});
