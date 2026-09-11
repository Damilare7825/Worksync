import React from 'react';
import { Card } from '../common/Card';
import { PieChart, BarChart3 } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function AnalyticsCharts() {
  const { tasks, projects } = useWorkSync();

  const total = tasks.length || 1;
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const reviewCount = tasks.filter((t) => t.status === 'review').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const statusBreakdown = [
    { label: 'Done', count: doneCount, color: '#10B981', pct: Math.round((doneCount / total) * 100) },
    { label: 'In Progress', count: inProgressCount, color: '#4F46E5', pct: Math.round((inProgressCount / total) * 100) },
    { label: 'Review', count: reviewCount, color: '#F59E0B', pct: Math.round((reviewCount / total) * 100) },
    { label: 'To Do', count: todoCount, color: '#94A3B8', pct: Math.round((todoCount / total) * 100) }
  ];

  // Real, derived-from-live-data breakdown. The backend has no time-series
  // endpoint (no daily task-completion history), so rather than fake a
  // "weekly velocity" chart with invented numbers, this shows tasks per
  // project instead — every number here is real.
  const perProject = projects
    .map((p) => ({ name: p.name, count: tasks.filter((t) => t.projectId === p.id).length }))
    .sort((a, b) => b.count - a.count);
  const maxProjectCount = Math.max(1, ...perProject.map((p) => p.count));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tasks per Project</h3>
            <p className="text-xs text-slate-500 mt-0.5">Live distribution across active projects</p>
          </div>
          <BarChart3 className="w-4 h-4 text-slate-400" />
        </div>

        {perProject.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-medium">
            No projects yet.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {perProject.map((p) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">{p.name}</span>
                  <span className="font-mono text-slate-500">{p.count}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${(p.count / maxProjectCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tasks by Status Breakdown */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tasks by Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribution across columns</p>
          </div>
          <PieChart className="w-4 h-4 text-slate-400" />
        </div>

        <div className="space-y-4 pt-2">
          {statusBreakdown.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-mono text-slate-500">
                  {item.count} ({item.pct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
