/**
 * Development-only seed data for WorkSync.
 * DO NOT run this against a production database — it deletes existing rows.
 *
 * Demonstrates the core point of the RBAC model: workspace role and
 * project role are independent. David is a workspace MEMBER but a project
 * MANAGER on "Website Redesign" — that's allowed and expected.
 *
 * Usage: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Password123'; // Dev-only fixture password, not a real credential.

async function main() {
  console.log('[seed] Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  console.log('[seed] Creating users...');
  const [dare, sarah, david, john] = await Promise.all(
    [
      { name: 'Dare Adeyemi', email: 'dare@worksync.dev' },
      { name: 'Sarah Bello', email: 'sarah@worksync.dev' },
      { name: 'David Chukwu', email: 'david@worksync.dev' },
      { name: 'John Eze', email: 'john@worksync.dev' },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash } }))
  );

  console.log('[seed] Creating workspace "MarvinsStack"...');
  const workspace = await prisma.workspace.create({
    data: { name: 'MarvinsStack', createdBy: dare.id },
  });

  console.log('[seed] Creating workspace memberships (Dare=OWNER, Sarah=ADMIN, David/John=MEMBER)...');
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: dare.id, role: 'OWNER' },
      { workspaceId: workspace.id, userId: sarah.id, role: 'ADMIN' },
      { workspaceId: workspace.id, userId: david.id, role: 'MEMBER' },
      { workspaceId: workspace.id, userId: john.id, role: 'MEMBER' },
    ],
  });

  console.log('[seed] Creating teams (Engineering, Design, Marketing)...');
  const [engineering, design] = await Promise.all([
    prisma.team.create({
      data: { workspaceId: workspace.id, name: 'Engineering', createdBy: dare.id },
    }),
    prisma.team.create({
      data: { workspaceId: workspace.id, name: 'Design', createdBy: dare.id },
    }),
    prisma.team.create({
      data: { workspaceId: workspace.id, name: 'Marketing', createdBy: dare.id },
    }),
  ]);
  await prisma.teamMember.createMany({
    data: [
      { teamId: engineering.id, userId: david.id },
      { teamId: engineering.id, userId: john.id },
      { teamId: design.id, userId: sarah.id },
    ],
  });

  console.log('[seed] Creating projects (Website Redesign, Mobile Application)...');
  const websiteRedesign = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Website Redesign',
      description: 'Refresh the public marketing site',
      createdBy: sarah.id,
      status: 'ACTIVE',
    },
  });
  const mobileApp = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Mobile Application',
      description: 'Native iOS/Android companion app',
      createdBy: dare.id,
      status: 'ACTIVE',
    },
  });

  console.log('[seed] Creating project memberships (David=MANAGER on Website Redesign, John=MEMBER)...');
  await prisma.projectMember.createMany({
    data: [
      { projectId: websiteRedesign.id, userId: david.id, role: 'MANAGER' },
      { projectId: websiteRedesign.id, userId: john.id, role: 'MEMBER' },
      { projectId: mobileApp.id, userId: john.id, role: 'MEMBER' },
    ],
  });

  console.log('[seed] Creating tasks...');
  const heroTask = await prisma.task.create({
    data: {
      projectId: websiteRedesign.id,
      creatorId: david.id,
      assigneeId: john.id,
      title: 'Redesign homepage hero section',
      description: 'New hero layout per the approved Figma mock',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    },
  });
  await prisma.task.create({
    data: {
      projectId: websiteRedesign.id,
      creatorId: david.id,
      title: 'Audit accessibility on the pricing page',
      status: 'BACKLOG',
      priority: 'MEDIUM',
    },
  });
  await prisma.task.create({
    data: {
      projectId: mobileApp.id,
      creatorId: dare.id,
      assigneeId: john.id,
      title: 'Set up push notification infrastructure',
      status: 'TODO',
      priority: 'URGENT',
    },
  });

  console.log('[seed] Creating a comment and activity log entries...');
  await prisma.comment.create({
    data: { taskId: heroTask.id, userId: john.id, content: 'Started on the new layout, WIP in the PR.' },
  });

  await prisma.activityLog.createMany({
    data: [
      { workspaceId: workspace.id, userId: dare.id, action: 'WORKSPACE_CREATED', metadata: { name: workspace.name } },
      { workspaceId: workspace.id, projectId: websiteRedesign.id, userId: sarah.id, action: 'PROJECT_CREATED', metadata: { name: websiteRedesign.name } },
      {
        workspaceId: workspace.id,
        projectId: websiteRedesign.id,
        taskId: heroTask.id,
        userId: david.id,
        action: 'TASK_ASSIGNED',
        metadata: { assigneeId: john.id },
      },
    ],
  });

  console.log('[seed] Creating a sample notification for John...');
  await prisma.notification.create({
    data: {
      userId: john.id,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: `You were assigned "${heroTask.title}"`,
    },
  });

  console.log('\n[seed] Done. Seeded accounts (all use the same dev password):');
  console.log(`  Dare  (OWNER)         dare@worksync.dev`);
  console.log(`  Sarah (ADMIN)         sarah@worksync.dev`);
  console.log(`  David (MEMBER, and project MANAGER on Website Redesign) david@worksync.dev`);
  console.log(`  John  (MEMBER)        john@worksync.dev`);
  console.log(`  Dev login password: "${DEV_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
