import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { projectApi } from '../api/project.api.js';
import { taskApi } from '../api/task.api.js';
import { workspaceApi } from '../api/workspace.api.js';
import { notificationApi } from '../api/notification.api.js';
import { activityApi } from '../api/activity.api.js';
import { taskFromApi, STATUS_TO_API, colorForId, initialsOf } from '../utils/taskMapping.js';
import { connectSocket, disconnectSocket } from '../sockets/socket.js';

const WorkSyncContext = createContext(null);

export function WorkSyncProvider({ children }) {
  const { activeWorkspaceId, user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & filter UI state (not persisted server-side — purely local).
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  // Modal control state.
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // When set, TaskModal opens in "locked" mode for this project (opened
  // from ProjectDetail) — the picker is disabled and this project is used
  // instead of requiring the user to search/select one. Null means the
  // modal was opened globally (Tasks page) and a project must be chosen.
  const [taskModalProject, setTaskModalProject] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const usersById = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      map[m.user.id] = { ...m.user, color: colorForId(m.user.id) };
    });
    if (user) map[user.id] = { ...user, color: colorForId(user.id) };
    return map;
  }, [members, user]);

  const projectsById = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [projects]);

  const loadAll = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [projectsRes, membersRes, notificationsRes, activityRes] = await Promise.all([
        projectApi.list(activeWorkspaceId, { limit: 100 }),
        workspaceApi.listMembers(activeWorkspaceId, { limit: 100 }),
        notificationApi.list({ limit: 50 }),
        activityApi.listForWorkspace(activeWorkspaceId, { limit: 30 }),
      ]);

      const loadedProjects = projectsRes.data.projects;
      setProjects(loadedProjects);
      setMembers(membersRes.data.members);
      setNotifications(notificationsRes.data.notifications);
      setActivities(activityRes.data.activity);

      // Load all tasks for the workspace in a single request instead of
      // O(projects) per-project requests.
      const taskRes = await taskApi
        .listByWorkspace(activeWorkspaceId, { limit: 100, includeSubtasks: true })
        .catch(() => ({ data: { tasks: [] } }));
      setTasks(taskRes.data.tasks);
    } catch (err) {
      setError(err.message || 'Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    // Switching workspace: drop stale data immediately so the old
    // workspace's projects/tasks never render under the new one, even
    // briefly.
    setProjects([]);
    setTasks([]);
    setMembers([]);
    setNotifications([]);
    setActivities([]);
    loadAll();
  }, [activeWorkspaceId, loadAll]);

  // ---- Real-time task sync (Phase 10.3) --------------------------------
  //
  // Connect the shared socket once the user is authenticated, and register
  // task.created/task.updated/task.deleted listeners once for the life of
  // the session. Merges are idempotent — a create that already exists (our
  // own optimistic update from addTask()) is skipped, an update replaces
  // by id, a delete filters by id — so it doesn't matter whether an event
  // originated from this tab's own action or another collaborator's.
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const handleTaskCreated = ({ task }) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]));
    };
    const handleTaskUpdated = ({ task }) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    };
    const handleTaskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    socket.on('task.created', handleTaskCreated);
    socket.on('task.updated', handleTaskUpdated);
    socket.on('task.deleted', handleTaskDeleted);

    // Phase 10.4: live activity feed. Backend broadcasts every logged
    // activity entry (task changes, comments, ...) into the workspace's
    // room in the same shape listForWorkspace() returns, so it can be
    // merged in directly. Dedup by id in case of overlap with a fetch
    // that happened around the same time.
    const handleActivityCreated = ({ activity }) => {
      setActivities((prev) => (prev.some((a) => a.id === activity.id) ? prev : [activity, ...prev]));
    };
    socket.on('activity.created', handleActivityCreated);

    // Phase 10.5: live notifications. No room-join needed here — every
    // authenticated socket auto-joins its own user:{id} room on connect
    // (see backend room.handler.js), so this just listens for it.
    const handleNotificationCreated = ({ notification }) => {
      setNotifications((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
    };
    socket.on('notification.created', handleNotificationCreated);

    // Phase 10.6: presence. Fired whenever someone joins/leaves the
    // active workspace's room (their last connection to it, specifically
    // — see backend presence.js for the multi-tab bookkeeping).
    const handlePresenceOnline = ({ userId }) => {
      setOnlineUserIds((prev) => new Set(prev).add(userId));
    };
    const handlePresenceOffline = ({ userId }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    socket.on('presence.online', handlePresenceOnline);
    socket.on('presence.offline', handlePresenceOffline);

    // Phase 10.6 polish: reconnection resilience. Socket.IO rooms don't
    // survive a reconnect (a fresh socket.id means a fresh, empty set of
    // server-side rooms), so a network blip would otherwise silently stop
    // this tab from receiving task/activity/presence events for whatever
    // it had joined before, without any visible error. `connect` fires on
    // both the very first connection and every reconnect; resetting the
    // "already joined" refs and rejoining from current state (via refs,
    // since this handler is attached once and would otherwise close over
    // stale `projects`/`activeWorkspaceId`) makes reconnects self-healing.
    const handleConnect = () => {
      joinedProjectIdsRef.current.clear();
      projectsRef.current.forEach((p) => {
        socket.emit('project:join', { projectId: p.id }, () => {});
        joinedProjectIdsRef.current.add(p.id);
      });

      joinedWorkspaceIdRef.current = null;
      const workspaceId = activeWorkspaceIdRef.current;
      if (workspaceId) {
        socket.emit('workspace:join', { workspaceId }, (res) => {
          if (res?.ok) setOnlineUserIds(new Set(res.onlineUserIds || []));
        });
        joinedWorkspaceIdRef.current = workspaceId;
      }
    };
    socket.on('connect', handleConnect);

    return () => {
      socket.off('task.created', handleTaskCreated);
      socket.off('task.updated', handleTaskUpdated);
      socket.off('task.deleted', handleTaskDeleted);
      socket.off('activity.created', handleActivityCreated);
      socket.off('notification.created', handleNotificationCreated);
      socket.off('presence.online', handlePresenceOnline);
      socket.off('presence.offline', handlePresenceOffline);
      socket.off('connect', handleConnect);
    };
  }, [user]);

  // Join a Socket.IO room per visible project so this tab receives
  // task.* events scoped to it (see backend room.handler.js), and leave
  // rooms for projects that are no longer in view (workspace switch,
  // project removed).
  const joinedProjectIdsRef = useRef(new Set());
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    if (!user) {
      joinedProjectIdsRef.current.clear();
      return;
    }

    const socket = connectSocket();
    const currentIds = new Set(projects.map((p) => p.id));

    currentIds.forEach((id) => {
      if (!joinedProjectIdsRef.current.has(id)) {
        socket.emit('project:join', { projectId: id }, () => {});
        joinedProjectIdsRef.current.add(id);
      }
    });

    joinedProjectIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        socket.emit('project:leave', { projectId: id }, () => {});
        joinedProjectIdsRef.current.delete(id);
      }
    });
  }, [projects, user]);

  // Join the current workspace's room for the live activity feed
  // (activity.created) and presence. Leave the previous workspace's room
  // on switch.
  const joinedWorkspaceIdRef = useRef(null);
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!user || !activeWorkspaceId) {
      joinedWorkspaceIdRef.current = null;
      setOnlineUserIds(new Set());
      return;
    }

    const socket = connectSocket();

    if (joinedWorkspaceIdRef.current && joinedWorkspaceIdRef.current !== activeWorkspaceId) {
      socket.emit('workspace:leave', { workspaceId: joinedWorkspaceIdRef.current }, () => {});
    }

    socket.emit('workspace:join', { workspaceId: activeWorkspaceId }, (res) => {
      // Presence events after this point only carry deltas
      // (online/offline transitions) — this ack is what seeds "who's
      // already here" for a workspace this tab is joining fresh.
      setOnlineUserIds(new Set(res?.ok ? res.onlineUserIds || [] : []));
    });
    joinedWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId, user]);

  const uiTasks = useMemo(
    () => tasks.map((t) => taskFromApi(t, { projectsById, usersById })),
    [tasks, projectsById, usersById]
  );

  const uiProjects = useMemo(
    () =>
      projects.map((p) => {
        const projectTasks = tasks.filter((t) => t.projectId === p.id);
        const completed = projectTasks.filter((t) => t.status === 'COMPLETED').length;
        return {
          ...p,
          tasks: projectTasks.length,
          completed,
          due: p.dueDate ? p.dueDate.slice(0, 10) : '',
          status: p.status.toLowerCase(),
          members: [], // populated on-demand on the project detail view
        };
      }),
    [projects, tasks]
  );

  const uiTeam = useMemo(
    () =>
      members.map((m) => ({
        id: m.user.id,
        membershipId: m.id,
        name: m.user.id === user?.id ? `${m.user.name} (you)` : m.user.name,
        email: m.user.email,
        role: m.role, // OWNER / ADMIN / MEMBER — workspace role only
        joinedAt: m.joinedAt,
        initials: initialsOf(m.user.name),
        color: colorForId(m.user.id),
        online: onlineUserIds.has(m.user.id),
      })),
    [members, user, onlineUserIds]
  );

  // ---- Task actions -------------------------------------------------
  // Create payload deliberately excludes `status` — the backend always
  // establishes the default (TODO) on create; status only ever travels on
  // update (edit form, Kanban drag).
  const addTask = useCallback(async (formData) => {
    const res = await taskApi.create(formData.projectId, {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority ? formData.priority.toUpperCase() : undefined,
      dueDate: formData.due || undefined,
      assigneeId: formData.assigneeId || undefined,
    });
    setTasks((prev) => [res.data.task, ...prev]);
    return res.data.task;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    const payload = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priority !== undefined) payload.priority = updates.priority.toUpperCase();
    if (updates.status !== undefined) payload.status = STATUS_TO_API[updates.status];
    if (updates.due !== undefined) payload.dueDate = updates.due || null;
    if (updates.assigneeId !== undefined) payload.assigneeId = updates.assigneeId || null;

    const res = await taskApi.update(id, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? res.data.task : t)));
    return res.data.task;
  }, []);

  const deleteTask = useCallback(
    async (id) => {
      const prev = tasks;
      setTasks((cur) => cur.filter((t) => t.id !== id)); // optimistic
      try {
        await taskApi.remove(id);
      } catch (err) {
        setTasks(prev); // rollback
        throw err;
      }
    },
    [tasks]
  );

  // Kanban drag & reorder: optimistic per the spec (small UI state), with rollback on
  // failure — e.g. a project MEMBER dragging a task they don't own gets
  // reverted with an error rather than a UI that lies about the outcome.
  const moveTaskStatus = useCallback(
    async (id, newUiStatus, beforeTaskId = null) => {
      const previous = tasks;
      const apiStatus = STATUS_TO_API[newUiStatus] || newUiStatus;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: apiStatus } : t)));
      try {
        const res = await taskApi.move(id, { status: apiStatus, beforeTaskId });
        setTasks((prev) => prev.map((t) => (t.id === id ? res.data.task : t)));
      } catch (err) {
        setTasks(previous);
        setError(err.message || 'Could not move task — reverted');
        throw err;
      }
    },
    [tasks]
  );

  const bulkUpdateTasks = useCallback(
    async (payload) => {
      const previous = tasks;
      try {
        const res = await taskApi.bulkUpdate(payload);
        const updatedList = res.data.tasks || [];
        const updatedMap = new Map(updatedList.map((t) => [t.id, t]));
        setTasks((prev) => prev.map((t) => updatedMap.get(t.id) || t));
        return res.data;
      } catch (err) {
        setTasks(previous);
        setError(err.message || 'Bulk update failed');
        throw err;
      }
    },
    [tasks]
  );


  // ---- Project actions ------------------------------------------------
  const addProject = useCallback(
    async (formData) => {
      const res = await projectApi.create(activeWorkspaceId, {
        name: formData.name,
        description: formData.description || undefined,
        dueDate: formData.due || undefined,
      });
      setProjects((prev) => [res.data.project, ...prev]);
      return res.data.project;
    },
    [activeWorkspaceId]
  );

  const updateProject = useCallback(async (projectId, formData) => {
    const payload = {};
    if (formData.name !== undefined) payload.name = formData.name;
    if (formData.description !== undefined) payload.description = formData.description || null;
    if (formData.due !== undefined) payload.dueDate = formData.due || null;
    const res = await projectApi.update(projectId, payload);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? res.data.project : p)));
    return res.data.project;
  }, []);

  // ---- Invitation actions -----------------------------------------------
  const [pendingInvitations, setPendingInvitations] = useState([]);

  const loadPendingInvitations = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await workspaceApi.listPendingInvitations(activeWorkspaceId);
      setPendingInvitations(res.data.invitations);
    } catch {
      // Non-owner/admin callers get a 403 here — just leave the list empty
      // rather than surfacing an error for a section they can't see anyway.
      setPendingInvitations([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadPendingInvitations();
  }, [loadPendingInvitations]);

  const inviteMember = useCallback(
    async ({ email, role }) => {
      const res = await workspaceApi.invite(activeWorkspaceId, { email, role });
      // No membership row exists until accepted — nothing to add to
      // `members` yet. Real feedback is the returned invite link.
      await loadPendingInvitations();
      return res.data.inviteUrl;
    },
    [activeWorkspaceId, loadPendingInvitations]
  );

  const resendInvitation = useCallback(
    async (invitationId) => {
      const res = await workspaceApi.resendInvitation(activeWorkspaceId, invitationId);
      await loadPendingInvitations();
      return res.data.inviteUrl;
    },
    [activeWorkspaceId, loadPendingInvitations]
  );

  const cancelInvitation = useCallback(
    async (invitationId) => {
      await workspaceApi.cancelInvitation(activeWorkspaceId, invitationId);
      await loadPendingInvitations();
    },
    [activeWorkspaceId, loadPendingInvitations]
  );

  // ---- Notification actions --------------------------------------------
  const markNotificationRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationApi.markRead(id);
    } catch {
      // Non-critical UI state; leave optimistic value rather than jar the
      // user with a revert for a read receipt.
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationApi.markAllRead();
    } catch {
      // see markNotificationRead
    }
  }, []);

  const value = {
    loading,
    error,
    projects: uiProjects,
    tasks: uiTasks,
    team: uiTeam,
    onlineUserIds,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      unread: !n.read,
      type: n.type,
      invitationId: n.invitationId || null,
      time: new Date(n.createdAt).toLocaleString(),
      createdAt: n.createdAt,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      user: a.user?.name || 'Someone',
      initials: a.user ? initialsOf(a.user.name) : '?',
      color: a.user ? colorForId(a.user.id) : '#94A3B8',
      action: a.action,
      time: new Date(a.createdAt).toLocaleString(),
    })),

    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    projectFilter,
    setProjectFilter,

    isTaskModalOpen,
    setIsTaskModalOpen,
    editingTask,
    setEditingTask,
    taskModalProject,
    setTaskModalProject,
    isProjectModalOpen,
    setIsProjectModalOpen,
    editingProject,
    setEditingProject,
    isInviteModalOpen,
    setIsInviteModalOpen,

    addTask,
    updateTask,
    deleteTask,
    moveTaskStatus,
    bulkUpdateTasks,
    addProject,
    updateProject,
    inviteMember,
    pendingInvitations,
    resendInvitation,
    cancelInvitation,
    markNotificationRead,
    markAllNotificationsRead,
    reload: loadAll,
  };

  return <WorkSyncContext.Provider value={value}>{children}</WorkSyncContext.Provider>;
}

export function useWorkSync() {
  const ctx = useContext(WorkSyncContext);
  if (!ctx) throw new Error('useWorkSync must be used within WorkSyncProvider');
  return ctx;
}
