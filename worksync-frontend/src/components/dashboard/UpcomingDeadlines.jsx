import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export function UpcomingDeadlines({ tasks = [] }) {
  const sortedTasks = [...tasks]
    .filter(t => t.status !== 'done')
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 4);

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800/80 flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-tight">Upcoming Deadlines</h3>
          <p className="text-xs text-slate-400 mt-0.5">Tasks requiring prompt attention</p>
        </div>
        <Clock className="w-4 h-4 text-slate-400" />
      </div>

      <div className="divide-y divide-slate-800/50 flex-1 overflow-y-auto">
        {sortedTasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">No upcoming deadlines</div>
        ) : (
          sortedTasks.map((t) => {
            const isUrgent = t.priority === 'urgent';
            return (
              <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{t.title}</p>
                  <span className="text-[11px] text-slate-400 block truncate">{t.project}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      isUrgent
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isUrgent && <AlertCircle className="w-3 h-3 text-rose-400" />}
                    {t.due}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
