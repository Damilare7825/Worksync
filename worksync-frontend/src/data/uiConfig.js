// UI-only configuration (labels, colors) — not application data. Replaces
// data/mockData.js, which held fake users/projects/tasks/notifications.
// All real data now comes from the backend via src/api/*.

export const KANBAN_COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: '#64748B' },
  { id: 'todo', label: 'To Do', color: '#94A3B8' },
  { id: 'in_progress', label: 'In Progress', color: '#2563EB' },
  { id: 'review', label: 'Review', color: '#F59E0B' },
  { id: 'done', label: 'Done', color: '#10B981' }
];

export const PRIORITY_CONFIG = {
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'Medium', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  high: { label: 'High', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  urgent: { label: 'Urgent', cls: 'bg-red-50 text-red-700 border-red-200' }
};

export const STATUS_CONFIG = {
  backlog: { label: 'Backlog', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  todo: { label: 'To Do', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  review: { label: 'Review', cls: 'bg-purple-50 text-purple-600', dot: 'bg-purple-500' },
  done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' }
};

export const WORKSPACE_ROLE_LABELS = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member'
};

export const PROJECT_ROLE_LABELS = {
  MANAGER: 'Project Manager',
  MEMBER: 'Project Member'
};
