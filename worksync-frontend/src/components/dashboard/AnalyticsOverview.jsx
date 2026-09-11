import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Users } from 'lucide-react';

const STATUS_LABELS = {
  BACKLOG: 'Backlog',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  COMPLETED: 'Completed',
};

function Metric({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300 border border-slate-700/50',
    blue: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  };
  return (
    <div className="min-w-0 border-r border-slate-800/80 px-4 first:pl-0 last:border-r-0 last:pr-0">
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}

export function AnalyticsOverview({ analytics }) {
  if (!analytics) return null;
  const { summary, distributions, workload, deadlines } = analytics;
  const statusEntries = Object.entries(distributions.status).filter(([, count]) => count > 0);
  const maxWorkload = Math.max(...workload.map((entry) => entry.taskCount), 1);

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          <Metric icon={ClipboardCheck} label="Assigned to you" value={analytics.assignedTasks} tone="blue" />
          <Metric icon={CheckCircle2} label="Completion" value={summary.completionRate === null ? '—' : `${summary.completionRate}%`} tone="green" />
          <Metric icon={AlertTriangle} label="Overdue" value={summary.overdueTasks} tone={summary.overdueTasks ? 'red' : 'slate'} />
          <Metric icon={Users} label="Watched tasks" value={analytics.watchedTasks} tone="slate" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="glass-card rounded-2xl xl:col-span-2 p-5 border border-slate-800/80">
          <div className="flex items-baseline justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-extrabold text-white">Work by status</h2>
            <span className="text-xs text-slate-400">{summary.totalTasks} visible tasks</span>
          </div>
          {statusEntries.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">Task distribution appears after work is added.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {statusEntries.map(([status, count]) => {
                const ratio = summary.totalTasks ? Math.round((count / summary.totalTasks) * 100) : 0;
                return (
                  <div key={status} className="grid grid-cols-[100px_1fr_36px] items-center gap-3 text-xs">
                    <span className="truncate text-slate-300 font-medium">{STATUS_LABELS[status]}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" style={{ width: `${ratio}%` }} />
                    </div>
                    <span className="text-right font-mono font-bold text-slate-200">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800/80">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-extrabold text-white">Team workload</h2>
            <p className="mt-0.5 text-xs text-slate-400">Tasks across accessible projects</p>
          </div>
          {workload.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No assigned work yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {workload.slice(0, 5).map(({ user, taskCount }) => (
                <div key={user.id}>
                  <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-slate-300 font-medium">{user.name}</span><span className="font-mono font-bold text-slate-200">{taskCount}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.round((taskCount / maxWorkload) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(deadlines.dueToday > 0 || deadlines.upcoming > 0) && (
        <p className="text-xs text-slate-400">{deadlines.dueToday} due today · {deadlines.upcoming} due in the next 7 days</p>
      )}
    </div>
  );
}
