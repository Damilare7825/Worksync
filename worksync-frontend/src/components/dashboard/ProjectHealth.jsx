import React from 'react';
import { FolderKanban } from 'lucide-react';

export function ProjectHealth({ projects = [] }) {
  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800/80 flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-tight">Project Health</h3>
          <p className="text-xs text-slate-400 mt-0.5">Active completion tracking</p>
        </div>
        <FolderKanban className="w-4 h-4 text-slate-400" />
      </div>

      <div className="space-y-4 pt-3 flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">No active projects</div>
        ) : (
          projects.map((proj) => {
            const pct = Math.round((proj.completed / (proj.tasks || 1)) * 100);
            return (
              <div key={proj.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 truncate">{proj.name}</span>
                  <span className="text-slate-400 font-mono font-medium">
                    {proj.completed}/{proj.tasks} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
