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

describe('Phase 25 — End-to-End User Journey & Integration Suite', () => {
  let userAToken;
  let _userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let workspaceId;
  let projectId;
  let taskId;

  test('1. User A (Owner) registers, authenticates, and initializes workspace', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice.owner@e2e.test',
        password: 'Password123!',
      });
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    userAToken = regRes.body.data.token;
    _userAId = regRes.body.data.user.id;
    expect(userAToken).toBeTruthy();

    // Verify User A profile / me endpoint
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('alice.owner@e2e.test');

    // User A creates primary workspace
    const wsRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Acme Global Ventures', description: 'Main production workspace' });
    expect(wsRes.status).toBe(201);
    expect(wsRes.body.success).toBe(true);
    workspaceId = wsRes.body.data.workspace.id;
    expect(workspaceId).toBeTruthy();

    // Verify workspace details and membership
    const wsDetail = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(wsDetail.status).toBe(200);
    expect(wsDetail.body.data.workspace.name).toBe('Acme Global Ventures');
  });

  test('2. User A invites User B via email invitation; User B registers and joins', async () => {
    // User A creates an invitation for User B
    const inviteRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        email: 'bob.developer@e2e.test',
        role: 'MEMBER',
      });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.success).toBe(true);
    const rawToken = inviteRes.body.data.inviteUrl.split('/invitations/')[1];
    expect(rawToken).toBeTruthy();

    // User B registers
    const regBRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bob Developer',
        email: 'bob.developer@e2e.test',
        password: 'Password123!',
      });
    expect(regBRes.status).toBe(201);
    userBToken = regBRes.body.data.token;
    userBId = regBRes.body.data.user.id;

    // User B accepts the invitation
    const acceptRes = await request(app)
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    // Verify User B now has access to the workspace
    const bWorkspaces = await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(bWorkspaces.status).toBe(200);
    const joinedWs = bWorkspaces.body.data.workspaces.find((w) => w.id === workspaceId);
    expect(joinedWs).toBeDefined();
  });

  test('3. User A creates a project and adds User B as project member', async () => {
    const projRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Mobile Client v2',
        description: 'Next-gen iOS and Android apps',
        color: '#4F46E5',
      });
    expect(projRes.status).toBe(201);
    expect(projRes.body.success).toBe(true);
    projectId = projRes.body.data.project.id;
    expect(projectId).toBeTruthy();

    // Add Bob to project
    const addMemberRes = await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userId: userBId,
        role: 'MEMBER',
      });
    expect([200, 201]).toContain(addMemberRes.status);
    expect(addMemberRes.body.success).toBe(true);

    // Verify User B can access the project
    const bProjRes = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(bProjRes.status).toBe(200);
    expect(bProjRes.body.data.project.name).toBe('Mobile Client v2');
  });

  test('4. Task lifecycle: User A creates task, assigns to User B; User B transitions status and comments', async () => {
    // User A creates task assigned to User B
    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Implement Biometric Authentication',
        description: 'Support Face ID and Touch ID with keychain storage',
        priority: 'HIGH',
        assigneeId: userBId,
      });
    expect(taskRes.status).toBe(201);
    expect(taskRes.body.success).toBe(true);
    taskId = taskRes.body.data.task.id;
    expect(taskRes.body.data.task.status).toBe('TODO');

    // User B reads assigned tasks in project
    const bTasksRes = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(bTasksRes.status).toBe(200);
    expect(bTasksRes.body.data.tasks.some((t) => t.id === taskId)).toBe(true);

    // User B transitions task to IN_PROGRESS
    const updateProgressRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(updateProgressRes.status).toBe(200);
    expect(updateProgressRes.body.data.task.status).toBe('IN_PROGRESS');

    // User B posts a comment with progress update
    const commentRes = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ content: 'Local keychain helper and biometric prompt completed. Ready for review.' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.success).toBe(true);

    // User B transitions status to IN_REVIEW
    const updateReviewRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ status: 'IN_REVIEW' });
    expect(updateReviewRes.status).toBe(200);
    expect(updateReviewRes.body.data.task.status).toBe('IN_REVIEW');

    // User A reviews and transitions task to COMPLETED
    const updateDoneRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: 'COMPLETED' });
    expect(updateDoneRes.status).toBe(200);
    expect(updateDoneRes.body.data.task.status).toBe('COMPLETED');
  });

  test('5. Cross-cutting checks: activities and dashboard reflect progress', async () => {
    // Check workspace activity feed includes recorded actions
    const actRes = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body.success).toBe(true);
    expect(actRes.body.data.activity.length).toBeGreaterThan(0);

    // Check dashboard statistics
    const statsRes = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data).toBeDefined();
  });

  test('6. Multi-tenant security & IDOR protection: User C cannot access Workspace A resources', async () => {
    // Register User C who creates their own separate workspace
    const regCRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Charlie Outsider',
        email: 'charlie.outsider@e2e.test',
        password: 'Password123!',
      });
    expect(regCRes.status).toBe(201);
    userCToken = regCRes.body.data.token;

    // User C attempts to read Acme workspace details
    const unauthWs = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect([403, 404]).toContain(unauthWs.status);

    // User C attempts to access Acme project
    const unauthProj = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect([403, 404]).toContain(unauthProj.status);

    // User C attempts to access Acme task
    const unauthTask = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect([403, 404]).toContain(unauthTask.status);

    // User C attempts to post comment on Acme task
    const unauthComment = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${userCToken}`)
      .send({ content: 'Malicious IDOR comment injection' });
    expect([403, 404]).toContain(unauthComment.status);

    // User C attempts to read Acme activities
    const unauthAct = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect([403, 404]).toContain(unauthAct.status);
  });
});
