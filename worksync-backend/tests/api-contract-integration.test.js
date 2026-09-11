import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let app;
let request;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  const supertestModule = await import('supertest');
  request = supertestModule.default;

  const appModule = await import('../src/app.js');
  app = appModule.createApp();
});

describe('API Contract & Flow Integration Tests', () => {
  test('a revoked session cannot continue using its existing access token', async () => {
    const email = `revoked-${Date.now()}@contract.test`;
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Revoked Session Tester',
      email,
      password: 'Password123!',
    });
    expect(registration.status).toBe(201);

    const session = await prisma.session.findFirst({ where: { userId: registration.body.data.user.id } });
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });

  test('Complete End-to-End User Flow via HTTP Endpoints', async () => {
    // 1. Register User
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Contract Tester',
      email: 'tester@contract.test',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.user.email).toBe('tester@contract.test');

    // 2. Login User
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'tester@contract.test',
      password: 'Password123!',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    const token = loginRes.body.data.token;
    expect(token).toBeDefined();

    // 3. Get User Preferences
    const prefRes = await request(app)
      .get('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(prefRes.status).toBe(200);
    expect(prefRes.body.success).toBe(true);

    // 4. Update User Preferences
    const patchPrefRes = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'DARK', compactDensity: true });
    expect(patchPrefRes.status).toBe(200);
    expect(patchPrefRes.body.success).toBe(true);

    // 5. Update Notification Preferences
    const patchNotifRes = await request(app)
      .patch('/api/v1/users/me/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ replies: false, comments: true });
    expect(patchNotifRes.status).toBe(200);
    expect(patchNotifRes.body.success).toBe(true);

    // 6. Create Workspace
    const wsRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Integration Workspace' });
    expect(wsRes.status).toBe(201);
    expect(wsRes.body.success).toBe(true);
    const workspaceId = wsRes.body.data.workspace.id;

    // 7. Create Project
    const projRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Core Integration Project' });
    expect(projRes.status).toBe(201);
    expect(projRes.body.success).toBe(true);
    const projectId = projRes.body.data.project.id;

    // 8. Create Task
    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Build Contract Test' });
    expect(taskRes.status).toBe(201);
    expect(taskRes.body.success).toBe(true);
    const taskId = taskRes.body.data.task.id;

    // 9. Add Comment
    const commentRes = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Initial comment on contract task' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.success).toBe(true);

    // 10. List Comments
    const listCommentsRes = await request(app)
      .get(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${token}`);
    expect(listCommentsRes.status).toBe(200);
    expect(listCommentsRes.body.success).toBe(true);
    expect(listCommentsRes.body.data.comments.length).toBeGreaterThan(0);
  });
});
