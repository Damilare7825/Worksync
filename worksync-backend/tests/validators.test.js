import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../src/validators/auth.validator.js';
import { createTaskSchema } from '../src/validators/task.validator.js';
import { createWorkspaceSchema, inviteMemberSchema, updateMemberRoleSchema } from '../src/validators/workspace.validator.js';
import { addProjectMemberSchema } from '../src/validators/project.validator.js';

describe('auth validators', () => {
  test('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ADA@Example.com',
      password: 'Password123',
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('ada@example.com'); // normalized to lowercase
  });

  test('rejects a weak password', () => {
    const result = registerSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'weak',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  test('accepts and normalizes a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'ADA@Example.com' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('ada@example.com');
  });

  test('rejects a missing email', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  test('accepts a valid token and strong password', () => {
    const result = resetPasswordSchema.safeParse({ token: 'abc123', password: 'Password123' });
    expect(result.success).toBe(true);
  });

  test('rejects an empty token', () => {
    const result = resetPasswordSchema.safeParse({ token: '', password: 'Password123' });
    expect(result.success).toBe(false);
  });

  test('rejects a weak new password', () => {
    const result = resetPasswordSchema.safeParse({ token: 'abc123', password: 'weak' });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  test('accepts a valid, differing current/new password pair', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
    });
    expect(result.success).toBe(true);
  });

  test('rejects when new password matches current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SamePassword123',
      newPassword: 'SamePassword123',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a weak new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword123',
      newPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

describe('task validators', () => {
  test('rejects a task with no title', () => {
    const result = createTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects an invalid assigneeId', () => {
    const result = createTaskSchema.safeParse({ title: 'Do the thing', assigneeId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('accepts a minimal valid task', () => {
    const result = createTaskSchema.safeParse({ title: 'Ship the feature' });
    expect(result.success).toBe(true);
  });

  test('accepts a full task payload without status', () => {
    const result = createTaskSchema.safeParse({
      title: 'Ship the feature',
      description: 'Details here',
      priority: 'HIGH',
      assigneeId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  test('rejects status being sent on create at all — backend must default it', () => {
    const result = createTaskSchema.safeParse({ title: 'Ship it', status: 'IN_PROGRESS' });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid status enum value', () => {
    const result = createTaskSchema.safeParse({ title: 'Ship it', status: 'DONE' });
    expect(result.success).toBe(false);
  });
});

describe('workspace validators', () => {
  test('accepts a valid workspace name', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'MarvinsStack' }).success).toBe(true);
  });

  test('rejects a too-short workspace name', () => {
    expect(createWorkspaceSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  test('inviteMemberSchema rejects OWNER as an invitable role', () => {
    const result = inviteMemberSchema.safeParse({ email: 'sarah@example.com', role: 'OWNER' });
    expect(result.success).toBe(false);
  });

  test('inviteMemberSchema accepts ADMIN and MEMBER', () => {
    expect(inviteMemberSchema.safeParse({ email: 'sarah@example.com', role: 'ADMIN' }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ email: 'sarah@example.com' }).success).toBe(true); // defaults to MEMBER
  });

  test('updateMemberRoleSchema accepts OWNER (used only for ownership transfer)', () => {
    expect(updateMemberRoleSchema.safeParse({ role: 'OWNER' }).success).toBe(true);
  });
});

describe('project validators', () => {
  test('addProjectMemberSchema rejects workspace-level roles', () => {
    const result = addProjectMemberSchema.safeParse({
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'ADMIN',
    });
    expect(result.success).toBe(false);
  });

  test('addProjectMemberSchema accepts MANAGER and MEMBER', () => {
    const base = { userId: '11111111-1111-1111-1111-111111111111' };
    expect(addProjectMemberSchema.safeParse({ ...base, role: 'MANAGER' }).success).toBe(true);
    expect(addProjectMemberSchema.safeParse(base).success).toBe(true); // defaults to MEMBER
  });
});
