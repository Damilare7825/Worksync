// The existing UI (Badge, KanbanBoard, TaskFilters, mockData's STATUS_CONFIG/
// PRIORITY_CONFIG) was built around lowercase keys: todo/in_progress/review/
// done and low/medium/high/urgent. The backend uses its own enums:
// BACKLOG/TODO/IN_PROGRESS/IN_REVIEW/COMPLETED and LOW/MEDIUM/HIGH/URGENT.
// Per the spec: map in the frontend, don't change the backend.
//
// One UI column had no backend equivalent (backlog) — added as a 5th
// column rather than silently dropping backend data.

export const STATUS_TO_UI = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'review',
  COMPLETED: 'done',
};

export const STATUS_TO_API = {
  backlog: 'BACKLOG',
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  review: 'IN_REVIEW',
  done: 'COMPLETED',
};

export const PRIORITY_TO_UI = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const PRIORITY_TO_API = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  urgent: 'URGENT',
};

export function taskFromApi(task, { projectsById = {}, usersById = {} } = {}) {
  const project = projectsById[task.projectId];
  const assignee = task.assigneeId ? usersById[task.assigneeId] : null;
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    projectId: task.projectId,
    project: project?.name || '',
    priority: PRIORITY_TO_UI[task.priority] || 'medium',
    status: STATUS_TO_UI[task.status] || 'todo',
    due: task.dueDate ? task.dueDate.slice(0, 10) : '',
    completedAt: task.completedAt || null,
    assigneeId: task.assigneeId || null,
    assignee: assignee?.name || 'Unassigned',
    initials: assignee ? initialsOf(assignee.name) : '—',
    color: assignee?.color || '#94A3B8',
    creatorId: task.creatorId,
    // Present only on tasks returned with includeSubtasks=true — used to
    // render a small "Subtask of ..." indicator on the board, and to mark
    // it visually distinct from a top-level task.
    parentTaskId: task.parentTaskId || null,
    // From the backend's `_count` include — how many subtasks this task
    // has and how many are done, for a "2/3 subtasks" indicator on the
    // parent's own card. Both undefined when the API didn't include counts.
    subtaskCount: task._count?.subtasks,
    subtaskCompletedCount: task.subtaskCompletedCount,
  };
}

export function initialsOf(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

// Deterministic-ish color per user id so the same person always gets the
// same avatar color across sessions without needing the backend to store one.
const PALETTE = ['#4F46E5', '#818CF8', '#34D399', '#FB923C', '#F472B6', '#38BDF8', '#A78BFA', '#FBBF24'];
export function colorForId(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
