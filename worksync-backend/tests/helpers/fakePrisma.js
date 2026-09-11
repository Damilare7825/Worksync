import { randomUUID } from 'crypto';

/**
 * A minimal, in-memory stand-in for PrismaClient, scoped to exactly the
 * query shapes the services under test actually use (equality/compound-key
 * `where`, simple `findMany` filters, `create`/`update`/`updateMany`/
 * `delete`, and a non-atomic `$transaction` that just runs the callback
 * against the same client).
 *
 * This is NOT a general Prisma mock — it exists so invitation/notification/
 * authorization/task service logic (the actual business rules) can be
 * exercised together, end-to-end, without a live Postgres instance. Field
 * shapes mirror prisma/schema.prisma; keep in sync if the schema changes.
 */

function matchWhere(record, where = {}) {
  return Object.entries(where).every(([key, val]) => {
    if (key === 'OR' && Array.isArray(val)) {
      return val.some((sub) => matchWhere(record, sub));
    }
    if (key === 'AND' && Array.isArray(val)) {
      return val.every((sub) => matchWhere(record, sub));
    }
    if (val && typeof val === 'object' && !(val instanceof Date)) {
      // String contains filter
      if ('contains' in val) {
        const actual = String(record[key] || '');
        const target = String(val.contains || '');
        if (val.mode === 'insensitive') {
          return actual.toLowerCase().includes(target.toLowerCase());
        }
        return actual.includes(target);
      }
      // Array some filter (e.g. labels: { some: { labelId } })
      if ('some' in val && Array.isArray(record[key])) {
        return record[key].some((item) => matchWhere(item, val.some));
      }
      // Range filter, e.g. createdAt: { gte, lte }
      if ('gte' in val || 'lte' in val || 'gt' in val || 'lt' in val) {
        const actual = record[key];
        if (actual === undefined || actual === null) return false;
        if ('gte' in val && !(actual >= val.gte)) return false;
        if ('lte' in val && !(actual <= val.lte)) return false;
        if ('gt' in val && !(actual > val.gt)) return false;
        if ('lt' in val && !(actual < val.lt)) return false;
        return true;
      }
      // Negation filter, e.g. status: { not: 'ARCHIVED' }
      if ('not' in val) {
        return record[key] !== val.not;
      }
      // Membership filter, e.g. id: { in: [...] }
      if ('in' in val) {
        if (!Array.isArray(val.in)) return false;
        return val.in.includes(record[key]);
      }
      if ('notIn' in val) {
        if (!Array.isArray(val.notIn)) return true;
        return !val.notIn.includes(record[key]);
      }
      // Compound unique key or nested relation check
      if (record[key] && typeof record[key] === 'object') {
        return matchWhere(record[key], val);
      }
      // Prisma compound unique key like workspaceId_userId: { workspaceId, userId }
      if (key.includes('_') && typeof val === 'object' && val !== null) {
        return Object.entries(val).every(([subKey, subVal]) => record[subKey] === subVal);
      }
      return Object.entries(val).every(([subKey, subVal]) => record[subKey] === subVal);
    }
    return record[key] === val || (val === null && record[key] === undefined);
  });
}


function createCollection(name, defaults = {}) {
  const store = [];

  return {
    _store: store,
    async findUnique({ where } = {}) {
      const record = store.find((r) => matchWhere(r, where));
      return record ? { ...record } : null;
    },
    async findFirst({ where } = {}) {
      const record = store.find((r) => matchWhere(r, where));
      return record ? { ...record } : null;
    },
    async findMany({ where = {}, orderBy, skip = 0, take } = {}) {
      let results = store.filter((r) => matchWhere(r, where));
      if (orderBy?.createdAt === 'desc') {
        results = [...results].sort((a, b) => b.createdAt - a.createdAt);
      }
      if (skip) results = results.slice(skip);
      if (take !== undefined) results = results.slice(0, take);
      return results;
    },
    async count({ where = {} } = {}) {
      return store.filter((r) => matchWhere(r, where)).length;
    },
    async groupBy({ by, where = {}, _count } = {}) {
      const results = store.filter((r) => matchWhere(r, where));
      const groups = new Map();
      for (const r of results) {
        const key = by.map((field) => r[field]).join('|');
        if (!groups.has(key)) {
          const entry = {};
          for (const field of by) entry[field] = r[field];
          entry._count = { _all: 0 };
          groups.set(key, entry);
        }
        groups.get(key)._count._all += 1;
      }
      return Array.from(groups.values());
    },
    async create({ data }) {
      // Mirrors Prisma applying `@default(...)` for fields the caller
      // omits — e.g. Task.status defaulting to TODO, Invitation.status
      // defaulting to INVITED. Real schema defaults live in
      // prisma/schema.prisma; `defaults` here is just the same values.
      const record = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
      store.push(record);
      return { ...record };
    },
    async update({ where, data }) {
      const record = store.find((r) => matchWhere(r, where));
      if (!record) {
        const err = new Error(`${name}: record not found for update`);
        err.code = 'P2025';
        throw err;
      }
      const merged = 'updatedAt' in data ? data : { ...data, updatedAt: new Date() };
      Object.assign(record, merged);
      return { ...record };
    },
    async updateMany({ where = {}, data }) {
      let count = 0;
      store.forEach((r) => {
        if (matchWhere(r, where)) {
          Object.assign(r, data, { updatedAt: new Date() });
          count += 1;
        }
      });
      return { count };
    },
    async delete({ where }) {
      const idx = store.findIndex((r) => matchWhere(r, where));
      if (idx === -1) {
        const err = new Error(`${name}: record not found for delete`);
        err.code = 'P2025';
        throw err;
      }
      const [record] = store.splice(idx, 1);
      return { ...record };
    },
    async deleteMany({ where = {} } = {}) {
      let count = 0;
      for (let i = store.length - 1; i >= 0; i--) {
        if (matchWhere(store[i], where)) {
          store.splice(i, 1);
          count += 1;
        }
      }
      return { count };
    },
  };
}

export function createFakePrisma() {
  const collections = {
    user: createCollection('user'),
    userPreference: createCollection('userPreference', { theme: 'SYSTEM', timezone: 'UTC', dateFormat: 'MM/dd/yyyy', timeFormat: 'hh:mm a', compactDensity: false }),
    notificationPreference: createCollection('notificationPreference', { taskAssignments: true, taskUpdates: true, dueDateReminders: true, mentions: true, comments: true, replies: true, reactions: true, workspaceActivity: true, projectActivity: true, invitations: true }),
    workspace: createCollection('workspace'),
    workspaceMember: createCollection('workspaceMember', { role: 'MEMBER' }),
    project: createCollection('project', { status: 'ACTIVE' }),
    projectMember: createCollection('projectMember', { role: 'MEMBER' }),
    team: createCollection('team'),
    teamMember: createCollection('teamMember'),
    task: createCollection('task', { status: 'TODO', priority: 'MEDIUM', assigneeId: null, dueDate: null, completedAt: null, parentTaskId: null, generatedFromRuleId: null }),
    invitation: createCollection('invitation', { status: 'INVITED' }),
    notification: createCollection('notification', { read: false }),
    activityLog: createCollection('activityLog'),
    comment: createCollection('comment', { parentCommentId: null, resolved: false, resolvedById: null, resolvedAt: null }),
    commentMention: createCollection('commentMention'),
    commentReaction: createCollection('commentReaction'),
    checklistItem: createCollection('checklistItem', { completed: false, position: 0 }),
    label: createCollection('label', { color: '#6366F1' }),
    taskLabel: createCollection('taskLabel'),
    taskWatcher: createCollection('taskWatcher'),
    taskDependency: createCollection('taskDependency', { type: 'DEPENDS_ON' }),
    recurrenceRule: createCollection('recurrenceRule', { interval: 1, timezone: 'UTC', active: true }),
    attachment: createCollection('attachment', { storageProvider: 'LOCAL' }),
    session: createCollection('session'),
    job: createCollection('job', { status: 'PENDING', attempts: 0, maxAttempts: 3 }),
  };

  const rawAttachmentCreate = collections.attachment.create.bind(collections.attachment);
  collections.attachment.create = async (args) => {
    const record = await rawAttachmentCreate(args);
    if (record && args?.include?.uploader) {
      const u = collections.user._store.find((usr) => usr.id === record.uploaderId);
      record.uploader = u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : null;
    }
    return record;
  };

  const rawAttachmentFindUnique = collections.attachment.findUnique.bind(collections.attachment);
  collections.attachment.findUnique = async (args) => {
    const record = await rawAttachmentFindUnique(args);
    if (record && args?.include?.uploader) {
      const u = collections.user._store.find((usr) => usr.id === record.uploaderId);
      record.uploader = u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : null;
    }
    return record;
  };

  const rawAttachmentFindMany = collections.attachment.findMany.bind(collections.attachment);
  collections.attachment.findMany = async (args) => {
    const results = await rawAttachmentFindMany(args);
    if (args?.include?.uploader) {
      for (const record of results) {
        const u = collections.user._store.find((usr) => usr.id === record.uploaderId);
        record.uploader = u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : null;
      }
    }
    return results;
  };

  // Phase 14 (advanced task system) relies on several relation `include`s
  // that a real PrismaClient resolves automatically. Same pattern as the
  // invitation.workspace wrapper above: wrap just the methods that need
  // it so callers get the same shape a real include would produce.
  const rawMemberFindMany = collections.workspaceMember.findMany.bind(collections.workspaceMember);
  collections.workspaceMember.findMany = async (args) => {
    const results = await rawMemberFindMany(args);
    const inc = args?.include || args?.select;
    if (!inc?.user) return results;
    return results.map((m) => {
      const u = collections.user._store.find((usr) => usr.id === m.userId);
      return { ...m, user: u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : null };
    });
  };

  const rawProjectMemberFindMany = collections.projectMember.findMany.bind(collections.projectMember);
  collections.projectMember.findMany = async (args) => {
    const whereCopy = { ...args?.where };
    const projectFilter = whereCopy.project;
    delete whereCopy.project;

    let results = await rawProjectMemberFindMany({ ...args, where: whereCopy });
    if (projectFilter?.workspaceId) {
      const wsId = projectFilter.workspaceId;
      results = results.filter((pm) => {
        const proj = collections.project._store.find((p) => p.id === pm.projectId);
        return proj && proj.workspaceId === wsId;
      });
    }
    return results;
  };


  const rawTaskFindUnique = collections.task.findUnique.bind(collections.task);

  collections.task.findUnique = async (args) => {
    const record = await rawTaskFindUnique(args);
    if (!record || !args?.include) return record;
    const inc = args.include;
    if (inc.subtasks) {
      record.subtasks = collections.task._store
        .filter((t) => t.parentTaskId === record.id)
        .sort((a, b) => a.createdAt - b.createdAt);
    }
    if (inc.parent) {
      const parent = record.parentTaskId ? collections.task._store.find((t) => t.id === record.parentTaskId) : null;
      record.parent = parent ? { id: parent.id, title: parent.title, status: parent.status } : null;
    }
    if (inc.checklistItems) {
      record.checklistItems = collections.checklistItem._store
        .filter((c) => c.taskId === record.id)
        .sort((a, b) => a.position - b.position);
    }
    if (inc.labels) {
      record.labels = collections.taskLabel._store
        .filter((tl) => tl.taskId === record.id)
        .map((tl) => ({ ...tl, label: collections.label._store.find((l) => l.id === tl.labelId) }));
    }
    if (inc.watchers) {
      record.watchers = collections.taskWatcher._store
        .filter((w) => w.taskId === record.id)
        .map((w) => ({ userId: w.userId }));
    }
    if (inc.recurrenceRule) {
      record.recurrenceRule = collections.recurrenceRule._store.find((r) => r.taskId === record.id) || null;
    }
    return record;
  };

  const rawTaskFindMany = collections.task.findMany.bind(collections.task);
  collections.task.findMany = async (args) => {
    const results = await rawTaskFindMany(args);
    const inc = args?.include;
    if (!inc) return results;
    for (const record of results) {
      if (inc.labels) {
        record.labels = collections.taskLabel._store
          .filter((tl) => tl.taskId === record.id)
          .map((tl) => ({ ...tl, label: collections.label._store.find((l) => l.id === tl.labelId) }));
      }
      if (inc._count?.select) {
        record._count = {
          subtasks: collections.task._store.filter((t) => t.parentTaskId === record.id).length,
          checklistItems: collections.checklistItem._store.filter((c) => c.taskId === record.id).length,
          watchers: collections.taskWatcher._store.filter((w) => w.taskId === record.id).length,
        };
      }
    }
    return results;
  };

  const rawDependencyFindMany = collections.taskDependency.findMany.bind(collections.taskDependency);
  collections.taskDependency.findMany = async (args) => {
    const results = await rawDependencyFindMany(args);
    const inc = args?.include;
    if (!inc) return results;
    for (const record of results) {
      if (inc.dependsOnTask) {
        const t = collections.task._store.find((tk) => tk.id === record.dependsOnTaskId);
        record.dependsOnTask = t ? { id: t.id, title: t.title, status: t.status } : null;
      }
      if (inc.task) {
        const t = collections.task._store.find((tk) => tk.id === record.taskId);
        record.task = t ? { id: t.id, title: t.title, status: t.status } : null;
      }
    }
    return results;
  };

  const rawWatcherFindMany = collections.taskWatcher.findMany.bind(collections.taskWatcher);
  collections.taskWatcher.findMany = async (args) => {
    const results = await rawWatcherFindMany(args);
    const inc = args?.include;
    if (!inc?.user) return results;
    for (const record of results) {
      const u = collections.user._store.find((usr) => usr.id === record.userId);
      record.user = u ? { id: u.id, name: u.name, avatar: u.avatar } : null;
    }
    return results;
  };

  // recurrenceRule.findUnique({..., include: { task: true }}) used by
  // generateOccurrenceIfDue.
  const rawRuleFindUnique = collections.recurrenceRule.findUnique.bind(collections.recurrenceRule);
  collections.recurrenceRule.findUnique = async (args) => {
    const record = await rawRuleFindUnique(args);
    if (record && args?.include?.task) {
      record.task = collections.task._store.find((t) => t.id === record.taskId) || null;
    }
    return record;
  };

  // Phase 15 (advanced discussions): comment.user/resolvedBy/mentions/
  // reactions includes, same wrapper pattern as above.
  function resolveCommentIncludes(record, inc) {
    if (!record || !inc) return record;
    if (inc.user) {
      const u = collections.user._store.find((usr) => usr.id === record.userId);
      record.user = u ? { id: u.id, name: u.name, avatar: u.avatar } : null;
    }
    if (inc.resolvedBy) {
      const u = record.resolvedById ? collections.user._store.find((usr) => usr.id === record.resolvedById) : null;
      record.resolvedBy = u ? { id: u.id, name: u.name } : null;
    }
    if (inc.mentions) {
      record.mentions = collections.commentMention._store
        .filter((m) => m.commentId === record.id)
        .map((m) => ({
          ...m,
          user: (() => {
            const u = collections.user._store.find((usr) => usr.id === m.userId);
            return u ? { id: u.id, name: u.name } : null;
          })(),
        }));
    }
    if (inc.reactions) {
      record.reactions = collections.commentReaction._store.filter((r) => r.commentId === record.id);
    }
    if (inc.replies) {
      const replyArgs = inc.replies;
      let replies = collections.comment._store
        .filter((comment) => comment.parentCommentId === record.id)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (replyArgs.take !== undefined) replies = replies.slice(0, replyArgs.take);
      record.replies = replies.map((reply) => resolveCommentIncludes({ ...reply }, replyArgs.include));
    }
    if (inc._count?.select?.replies) {
      record._count = {
        ...(record._count || {}),
        replies: collections.comment._store.filter((comment) => comment.parentCommentId === record.id).length,
      };
    }
    return record;
  }

  const rawCommentFindUnique = collections.comment.findUnique.bind(collections.comment);
  collections.comment.findUnique = async (args) => {
    const record = await rawCommentFindUnique(args);
    return resolveCommentIncludes(record, args?.include || args?.select);
  };
  const rawCommentFindMany = collections.comment.findMany.bind(collections.comment);
  collections.comment.findMany = async (args) => {
    const whereCopy = { ...args?.where };
    const taskFilter = whereCopy.task;
    delete whereCopy.task;

    let results = await rawCommentFindMany({ ...args, where: whereCopy });
    if (taskFilter?.projectId) {
      const targetProjFilter = taskFilter.projectId;
      results = results.filter((c) => {
        const t = collections.task._store.find((tk) => tk.id === c.taskId);
        if (!t) return false;
        if (typeof targetProjFilter === 'object' && Array.isArray(targetProjFilter.in)) {
          return targetProjFilter.in.includes(t.projectId);
        }
        return t.projectId === targetProjFilter;
      });
    }

    const inc = args?.include || args?.select;
    results = results.map((r) => resolveCommentIncludes(r, inc));
    if (inc?.task) {
      results = results.map((c) => {
        const t = collections.task._store.find((tk) => tk.id === c.taskId);
        const p = t ? collections.project._store.find((proj) => proj.id === t.projectId) : null;
        return {
          ...c,
          task: t ? { id: t.id, title: t.title, projectId: t.projectId, project: p ? { name: p.name } : null } : null,
        };
      });
    }
    return results;
  };
  const rawCommentCreate = collections.comment.create.bind(collections.comment);
  collections.comment.create = async (args) => {
    const record = await rawCommentCreate(args);
    return resolveCommentIncludes(record, args?.include || args?.select);
  };
  const rawCommentUpdate = collections.comment.update.bind(collections.comment);
  collections.comment.update = async (args) => {
    const record = await rawCommentUpdate(args);
    return resolveCommentIncludes(record, args?.include || args?.select);
  };



  const rawMentionFindMany = collections.commentMention.findMany.bind(collections.commentMention);

  collections.commentMention.findMany = async (args) => {
    const results = await rawMentionFindMany(args);
    if (!args?.include?.user) return results;
    return results.map((m) => {
      const u = collections.user._store.find((usr) => usr.id === m.userId);
      return { ...m, user: u ? { id: u.id, name: u.name } : null };
    });
  };

  // upsert isn't in the base createCollection — add it generically here
  // since only recurrenceRule needs it so far.
  collections.recurrenceRule.upsert = async ({ where, update, create }) => {
    const existing = await collections.recurrenceRule.findUnique({ where });
    if (existing) {
      return collections.recurrenceRule.update({ where, data: update });
    }
    return collections.recurrenceRule.create({ data: create });
  };

  // `invitation.findUnique`/`findFirst` in the real service sometimes use
  // `include: { workspace: { select: { id, name } } }`. Wrap just the
  // methods that need it so callers get `.workspace` attached, same as a
  // real Prisma relation include would produce.
  const rawInvitationFindUnique = collections.invitation.findUnique.bind(collections.invitation);
  collections.invitation.findUnique = async (args) => {
    const record = await rawInvitationFindUnique(args);
    if (record && args?.include?.workspace) {
      const ws = collections.workspace._store.find((w) => w.id === record.workspaceId);
      record.workspace = ws ? { id: ws.id, name: ws.name } : null;
    }
    return record;
  };

  const client = {
    ...collections,
    async $connect() {},
    async $disconnect() {},
    async $transaction(arg) {
      if (typeof arg === 'function') return arg(client);
      return Promise.all(arg);
    },
  };

  // Expose reset for tests
  client._resetAll = () => {
    for (const collection of Object.values(collections)) {
      if (Array.isArray(collection._store)) {
        collection._store.length = 0;
      }
    }
  };

  return client;
}
