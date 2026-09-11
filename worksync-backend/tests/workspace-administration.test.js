import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let workspaceService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  workspaceService = await import('../src/services/workspace.service.js');
});

async function seedWorkspace() {
  const owner = await prisma.user.create({ data: { name: 'Owner Olive', email: 'olive@ws.test', passwordHash: 'x' } });
  const admin = await prisma.user.create({ data: { name: 'Admin Amy', email: 'amy@ws.test', passwordHash: 'x' } });
  const member = await prisma.user.create({ data: { name: 'Member Mo', email: 'mo@ws.test', passwordHash: 'x' } });

  const workspace = await prisma.workspace.create({ data: { name: 'Acme', createdBy: owner.id } });
  const ownerM = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
  });
  const adminM = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: admin.id, role: 'ADMIN' },
  });
  const memberM = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' },
  });

  return { owner, admin, member, workspace, ownerM, adminM, memberM };
}

describe('workspace ownership transfer (Phase 12)', () => {
  test('transferring ownership atomically demotes the previous owner to ADMIN', async () => {
    const { owner, _admin, workspace, ownerM, adminM } = await seedWorkspace();

    const updatedTarget = await workspaceService.updateMemberRole(owner.id, workspace.id, adminM.id, 'OWNER');
    expect(updatedTarget.role).toBe('OWNER');

    const previousOwnerMembership = await prisma.workspaceMember.findUnique({ where: { id: ownerM.id } });
    expect(previousOwnerMembership.role).toBe('ADMIN');
  });

  test('the workspace always has exactly one OWNER after a transfer — never zero, never two', async () => {
    const { owner, admin, workspace, adminM } = await seedWorkspace();

    await workspaceService.updateMemberRole(owner.id, workspace.id, adminM.id, 'OWNER');

    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id } });
    const owners = members.filter((m) => m.role === 'OWNER');
    expect(owners).toHaveLength(1);
    expect(owners[0].userId).toBe(admin.id);
  });

  test('an ADMIN cannot transfer ownership or change roles — OWNER-only', async () => {
    const { admin, _member, workspace, memberM } = await seedWorkspace();

    await expect(workspaceService.updateMemberRole(admin.id, workspace.id, memberM.id, 'OWNER')).rejects.toThrow();
    await expect(workspaceService.updateMemberRole(admin.id, workspace.id, memberM.id, 'ADMIN')).rejects.toThrow();
  });

  test('an OWNER cannot demote themselves directly (must transfer ownership instead)', async () => {
    const { owner, workspace, ownerM } = await seedWorkspace();
    await expect(workspaceService.updateMemberRole(owner.id, workspace.id, ownerM.id, 'ADMIN')).rejects.toThrow();
  });
});

describe('workspace member removal (Phase 12)', () => {
  test('OWNER can remove a MEMBER', async () => {
    const { owner, workspace, memberM } = await seedWorkspace();
    await workspaceService.removeMember(owner.id, workspace.id, memberM.id);
    const remaining = await prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id } });
    expect(remaining.find((m) => m.id === memberM.id)).toBeUndefined();
  });

  test('ADMIN can remove a MEMBER but cannot remove the OWNER', async () => {
    const { admin, _owner, workspace, memberM, ownerM } = await seedWorkspace();
    await workspaceService.removeMember(admin.id, workspace.id, memberM.id);

    await expect(workspaceService.removeMember(admin.id, workspace.id, ownerM.id)).rejects.toThrow();
    const stillThere = await prisma.workspaceMember.findUnique({ where: { id: ownerM.id } });
    expect(stillThere).toBeTruthy();
  });

  test('a plain MEMBER cannot remove anyone', async () => {
    const { member, _admin, workspace, adminM } = await seedWorkspace();
    await expect(workspaceService.removeMember(member.id, workspace.id, adminM.id)).rejects.toThrow();
  });

  test('the OWNER can never be removed, even by themselves via this path', async () => {
    const { owner, workspace, ownerM } = await seedWorkspace();
    await expect(workspaceService.removeMember(owner.id, workspace.id, ownerM.id)).rejects.toThrow();
  });
});

describe('workspace settings (Phase 12)', () => {
  test('only OWNER can update workspace settings, not ADMIN', async () => {
    const { admin, workspace } = await seedWorkspace();
    await expect(workspaceService.updateWorkspace(admin.id, workspace.id, { name: 'New Name' })).rejects.toThrow();
  });

  test('OWNER can rename the workspace', async () => {
    const { owner, workspace } = await seedWorkspace();
    const updated = await workspaceService.updateWorkspace(owner.id, workspace.id, { name: 'Acme Renamed' });
    expect(updated.name).toBe('Acme Renamed');
  });

  test('only OWNER can delete the workspace', async () => {
    const { admin, owner, workspace } = await seedWorkspace();
    await expect(workspaceService.deleteWorkspace(admin.id, workspace.id)).rejects.toThrow();
    await expect(workspaceService.deleteWorkspace(owner.id, workspace.id)).resolves.toBeUndefined();
  });
});
