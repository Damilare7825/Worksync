import React from 'react';
import { AvatarGroup } from '../common/Avatar';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "On Track" / "At Risk" aren't stored anywhere — the backend only knows
// ACTIVE / COMPLETED / ARCHIVED. This derives a real risk signal from the
// project's own due date and actual task completion, rather than
// inventing a status the data doesn't support.
function deriveStatus(project, completed, total) {
  if (project.status === 'COMPLETED') return { label: 'Completed', cls: 'bg-slate-100 text-slate-500' };
  if (project.status === 'ARCHIVED') return { label: 'Archived', cls: 'bg-slate-100 text-slate-400' };
  if (project.dueDate) {
    const isOverdue = startOfDay(project.dueDate) < startOfDay(new Date());
    if (isOverdue && completed < total) {
      return { label: 'At Risk', cls: 'bg-red-50 text-red-600' };
    }
  }
  return { label: total > 0 ? 'On Track' : 'Active', cls: 'bg-emerald-50 text-emerald-600' };
}

export function ProjectCard({ project, completed = 0, total = 0, members = [], onClick }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const status = deriveStatus(project, completed, total);
  const dueLabel = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    : null;

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-slate-200 rounded-xl p-5 flex flex-col hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
          {project.name}
        </h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}>{status.label}</span>
      </div>

      <p className="text-xs text-slate-500 line-clamp-1 mb-5">{project.description || 'No description provided.'}</p>

      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 font-medium">
            {completed}/{total} tasks
          </span>
          <span className="font-semibold text-slate-700">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <AvatarGroup members={members} max={3} />
        {dueLabel && <span className="text-xs text-slate-400">Due {dueLabel}</span>}
      </div>
    </div>
  );
}
