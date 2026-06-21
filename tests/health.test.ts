/**
 * Pruebas unitarias para el endpoint de Salud (Health Check) del API Gateway
 * 
 * @module health
 */
import request from 'supertest';
import app from '../src/app';

describe('API Gateway - Salud', () => {
  it('GET /health debería retornar 200 con estado OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('service', 'FocoCero-Gateway');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/docs/ debería retornar 200 para la documentación swagger', async () => {
    // swagger-ui-express redirige /api/docs -> /api/docs/ (301)
    // Usar la barra inclinada final evita la redirección
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
