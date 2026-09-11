import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';

const app = createApp();

describe('app smoke tests', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /ready returns 503 when the database dependency is unavailable', async () => {
    const queryRawSpy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(app).get('/ready');

    queryRawSpy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('NOT_READY');
    expect(res.body.data.database).toBe('degraded');
  });

  test('GET /api/v1/unknown-route returns 404 with standard error shape', async () => {
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('GET /api/v1/tasks/:id without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/tasks/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/workspaces without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/workspaces').send({ name: 'MarvinsStack' });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/workspaces without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/workspaces');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/workspaces/:id/projects without a token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces/11111111-1111-1111-1111-111111111111/projects')
      .send({ name: 'Website Redesign' });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/projects/:projectId/tasks without a token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/projects/11111111-1111-1111-1111-111111111111/tasks')
      .send({ title: 'Do the thing' });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/tasks/:taskId/comments without a token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/tasks/11111111-1111-1111-1111-111111111111/comments')
      .send({ content: 'hi' });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/notifications without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/invitations/:token does NOT require a token (public lookup)', async () => {
    // Should reach the controller (and 404 on a nonexistent invitation)
    // rather than being rejected at the auth layer.
    const res = await request(app).get('/api/v1/invitations/some-random-token');
    expect(res.status).not.toBe(401);
  });

  test('POST /api/v1/invitations/:token/accept without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/invitations/some-random-token/accept');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/register with invalid body returns 422', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/auth/change-password without a token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/forgot-password with invalid body returns 422', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nope' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/auth/reset-password with invalid body returns 422', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({ token: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects an unapproved browser origin instead of enabling credentialed CORS', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://untrusted.example');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('allows a configured development origin and emits Helmet protections', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  test('rate limits repeated authentication attempts', async () => {
    let response;
    for (let i = 0; i < 25; i += 1) {
      response = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: 'x' });
      if (response.status === 429) break;
    }
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });
});
