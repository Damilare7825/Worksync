import { prisma } from '../config/database.js';
import { isWorkspaceAdminOrOwner } from './authorization.service.js';

/**
 * Calculates relevance score for ranking search matches.
 */
function computeScore(title = '', query = '', updatedAt = null) {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 75;
  else if (t.includes(` ${q}`)) score += 50;
  else if (t.includes(q)) score += 30;
  else score += 10;

  if (updatedAt) {
    const ageDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) score += 15;
    else if (ageDays < 30) score += 5;
  }

  return score;
}

export async function globalSearch(userId, workspaceId, filters = {}) {
  const {
    q = '',
    type = 'ALL',
    projectId,
    status,
    priority,
    assigneeId,
    labelId,
    authorId,
    resolved,
    dueFrom,
    dueTo,
    watcherId,
    archived,
    page = 1,
    limit = 10,
  } = filters;

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    return {
      tasks: [],
      projects: [],
      members: [],
      discussions: [],
      workspaces: [],
      pagination: { total: 0, page, limit },
    };
  }

  const queryStr = q.trim();
  const isPrivileged = isWorkspaceAdminOrOwner(membership.role);

  // Authorize visible projects in this workspace
  const visibleProjectIds = isPrivileged
    ? (
        await prisma.project.findMany({ where: { workspaceId }, select: { id: true } })
      ).map((p) => p.id)
    : (
        await prisma.projectMember.findMany({
          where: { userId, project: { workspaceId } },
          select: { projectId: true },
        })
      ).map((p) => p.projectId);

  // A caller-supplied project filter must further narrow, never replace,
  // the projects established by authorization above.
  const scopedProjectIds = projectId
    ? visibleProjectIds.filter((visibleProjectId) => visibleProjectId === projectId)
    : visibleProjectIds;

  const skip = (page - 1) * limit;

  // Build tasks query
  const shouldSearchTasks = type === 'ALL' || type === 'TASKS';
  let tasksPromise = Promise.resolve([]);
  if (shouldSearchTasks && scopedProjectIds.length > 0) {
    const taskWhere = {
      projectId: { in: scopedProjectIds },
    };
    if (['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].includes(status)) {
      taskWhere.status = status;
    }
    if (priority) taskWhere.priority = priority;
    if (assigneeId) taskWhere.assigneeId = assigneeId;
    if (labelId) {
      taskWhere.labels = { some: { labelId } };
    }
    if (watcherId) {
      taskWhere.watchers = { some: { userId: watcherId } };
    }
    if (dueFrom || dueTo) {
      taskWhere.dueDate = {
        ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
        ...(dueTo ? { lte: new Date(dueTo) } : {}),
      };
    }
    if (archived === true) {
      taskWhere.project = { ...(taskWhere.project || {}), status: 'ARCHIVED' };
    } else if (archived === false) {
      taskWhere.project = { ...(taskWhere.project || {}), status: { not: 'ARCHIVED' } };
    }
    if (queryStr) {
      taskWhere.OR = [
        { title: { contains: queryStr, mode: 'insensitive' } },
        { description: { contains: queryStr, mode: 'insensitive' } },
      ];
    }

    tasksPromise = prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        projectId: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      take: limit * 2,
    });
  }

  // Build projects query
  const shouldSearchProjects = type === 'ALL' || type === 'PROJECTS';
  let projectsPromise = Promise.resolve([]);
  if (shouldSearchProjects && scopedProjectIds.length > 0) {
    const projectWhere = {
      workspaceId,
      id: { in: scopedProjectIds },
    };
    if (['ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(status)) {
      projectWhere.status = status;
    }
    if (queryStr) {
      projectWhere.OR = [
        { name: { contains: queryStr, mode: 'insensitive' } },
        { description: { contains: queryStr, mode: 'insensitive' } },
      ];
    }

    projectsPromise = prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true, description: true, updatedAt: true, workspaceId: true },
      take: limit * 2,
    });
  }

  // Build members query
  const shouldSearchMembers = type === 'ALL' || type === 'MEMBERS';
  let membersPromise = Promise.resolve([]);
  if (shouldSearchMembers) {
    const memberWhere = { workspaceId };
    if (queryStr) {
      memberWhere.user = {
        OR: [
          { name: { contains: queryStr, mode: 'insensitive' } },
          { email: { contains: queryStr, mode: 'insensitive' } },
        ],
      };
    }

    membersPromise = prisma.workspaceMember.findMany({
      where: memberWhere,
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      take: limit * 2,
    });
  }

  // Build discussions/comments query
  const shouldSearchDiscussions = type === 'ALL' || type === 'DISCUSSIONS';
  let discussionsPromise = Promise.resolve([]);
  if (shouldSearchDiscussions && scopedProjectIds.length > 0) {
    const commentWhere = {
      task: { projectId: { in: scopedProjectIds } },
    };
    if (authorId) commentWhere.userId = authorId;
    if (resolved !== undefined) commentWhere.resolved = resolved;
    if (queryStr) {
      commentWhere.content = { contains: queryStr, mode: 'insensitive' };
    }

    discussionsPromise = prisma.comment.findMany({
      where: commentWhere,
      select: {
        id: true,
        content: true,
        resolved: true,
        createdAt: true,
        taskId: true,
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: { select: { name: true } },
          },
        },
        user: { select: { id: true, name: true, avatar: true } },
      },
      take: limit * 2,
    });
  }

  // Build workspaces query
  const shouldSearchWorkspaces = type === 'ALL' || type === 'WORKSPACES';
  let workspacesPromise = Promise.resolve([]);
  if (shouldSearchWorkspaces && queryStr) {
    workspacesPromise = prisma.workspace.findMany({
      where: {
        members: { some: { userId } },
        name: { contains: queryStr, mode: 'insensitive' },
      },
      select: { id: true, name: true, createdAt: true },
      take: limit,
    });
  }

  const [rawTasks, rawProjects, rawMembers, rawDiscussions, rawWorkspaces] = await Promise.all([
    tasksPromise,
    projectsPromise,
    membersPromise,
    discussionsPromise,
    workspacesPromise,
  ]);

  // Rank and slice results
  const rankedTasks = rawTasks
    .map((t) => ({ ...t, _score: computeScore(t.title, queryStr, t.updatedAt) }))
    .sort((a, b) => b._score - a._score)
    .slice(skip, skip + limit);

  const rankedProjects = rawProjects
    .map((p) => ({ ...p, _score: computeScore(p.name, queryStr, p.updatedAt) }))
    .sort((a, b) => b._score - a._score)
    .slice(skip, skip + limit);

  const rankedMembers = rawMembers
    .map((m) => ({
      ...m.user,
      workspaceRole: m.role,
      _score: computeScore(m.user.name, queryStr),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(skip, skip + limit);

  const rankedDiscussions = rawDiscussions
    .map((d) => ({ ...d, _score: computeScore(d.content, queryStr, d.createdAt) }))
    .sort((a, b) => b._score - a._score)
    .slice(skip, skip + limit);

  // Ranking is applied in-process over a bounded window (take: limit*2).
  // `pagination.total` is the size of that window across types so the
  // client can page without treating the current page length as the corpus.

  return {
    tasks: rankedTasks,
    projects: rankedProjects,
    members: rankedMembers,
    discussions: rankedDiscussions,
    workspaces: rawWorkspaces,
    pagination: {
      page,
      limit,
      totals: {
        tasks: rawTasks.length,
        projects: rawProjects.length,
        members: rawMembers.length,
        discussions: rawDiscussions.length,
        workspaces: rawWorkspaces.length,
      },
      total:
        rawTasks.length +
        rawProjects.length +
        rawMembers.length +
        rawDiscussions.length +
        rawWorkspaces.length,
    },
  };
}

/**
 * Returns fast search suggestions for search inputs/autocomplete.
 */
export async function getSuggestions(userId, workspaceId, query = '') {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    return { suggestions: [] };
  }

  const q = query.trim();
  if (!q) {
    return { suggestions: [] };
  }

  const isPrivileged = isWorkspaceAdminOrOwner(membership.role);
  const visibleProjectIds = isPrivileged
    ? (
        await prisma.project.findMany({ where: { workspaceId }, select: { id: true } })
      ).map((p) => p.id)
    : (
        await prisma.projectMember.findMany({
          where: { userId, project: { workspaceId } },
          select: { projectId: true },
        })
      ).map((p) => p.projectId);

  const [tasks, projects, members, labels] = await Promise.all([
    visibleProjectIds.length === 0
      ? []
      : prisma.task.findMany({
          where: {
            projectId: { in: visibleProjectIds },
            title: { contains: q, mode: 'insensitive' },
          },
          select: { id: true, title: true, projectId: true },
          take: 4,
        }),
    visibleProjectIds.length === 0
      ? []
      : prisma.project.findMany({
          where: {
            workspaceId,
            id: { in: visibleProjectIds },
            name: { contains: q, mode: 'insensitive' },
          },
          select: { id: true, name: true },
          take: 4,
        }),
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { name: { contains: q, mode: 'insensitive' } },
      },
      select: { user: { select: { id: true, name: true } } },
      take: 4,
    }),
    prisma.label.findMany({
      where: {
        workspaceId,
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, name: true, color: true },
      take: 3,
    }),
  ]);

  const suggestions = [
    ...tasks.map((t) => ({ type: 'TASK', id: t.id, title: t.title, targetId: t.projectId })),
    ...projects.map((p) => ({ type: 'PROJECT', id: p.id, title: p.name, targetId: p.id })),
    ...members.map((m) => ({ type: 'MEMBER', id: m.user.id, title: m.user.name, targetId: m.user.id })),
    ...labels.map((l) => ({ type: 'LABEL', id: l.id, title: l.name, color: l.color })),
  ];

  return { suggestions };
}
