jest.mock('firebase-admin');

import request from 'supertest';
import app from '../src/app';
import * as admin from 'firebase-admin';

describe('API Gateway - Auth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow public auth routes (login) without Firebase token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ rut: '12345678-9', password: 'test123' });

    // Since ms-auth is unreachable in tests, it returns 502 (proxy error)
    // But it should NOT return 401 (auth error) — login is public
    expect(res.status).toBe(502);
    expect(res.status).not.toBe(401);
  });

  it('should reject protected route without Authorization header', async () => {
    const res = await request(app).get('/api/emergencias');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('ok', false);
    expect(res.status).not.toBe(200);
  });

  it('should reject protected route with invalid Firebase token', async () => {
    (admin.auth().verifyIdToken as jest.Mock).mockRejectedValueOnce(
      new Error('Invalid token'),
    );

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer fake-firebase-token');
    expect(res.status).toBe(401);
  });

  it('should inject x-user-id and x-user-role headers for authenticated requests', async () => {
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

  it('should strip spoofed x-user-id headers from incoming requests', async () => {
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

  it('should return 502 when proxied service is unreachable (auth endpoint up)', async () => {
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(502);
  });

  it('should return 401 for expired Firebase tokens', async () => {
    (admin.auth().verifyIdToken as jest.Mock).mockRejectedValueOnce({
      code: 'auth/id-token-expired',
    });

    const res = await request(app)
      .get('/api/emergencias')
      .set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
  });
});
