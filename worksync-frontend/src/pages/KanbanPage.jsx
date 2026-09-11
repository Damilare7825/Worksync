import React from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { useWorkSync } from '../context/WorkSyncContext';
import { Filter, Plus, User } from 'lucide-react';

export function KanbanPage() {
  const { tasks, searchQuery, loading, error, team } = useWorkSync();

  const filteredTasks = searchQuery
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.project.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks;

  if (loading) {
    return (
      <AppLayout title="Kanban Board" subtitle="Visual workflow columns with drag & drop status updates">
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#d0bcff] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Kanban Board" subtitle="Visual workflow columns with drag & drop status updates">
      <div className="flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden bg-[#131314]">
        {/* Sprint Header */}
        <div className="flex-none px-8 py-5 flex items-center justify-between border-b border-[#353436]/40">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-extrabold text-[#e5e2e3] tracking-tight">Q3 Marketing Campaign</h1>
            <div className="px-3 py-1 rounded-full bg-[#201f20] text-[#cbc3d7] text-xs font-semibold flex items-center gap-2 border border-[#353436]/40">
              <span className="w-2 h-2 rounded-full bg-[#4edea3]" /> Active Sprint
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-[#201f20] px-4 py-2 rounded-xl text-[#cbc3d7] text-xs font-semibold hover:bg-[#2a2a2b] transition-colors border border-[#353436]/40 cursor-pointer">
              <Filter className="w-4 h-4 text-[#d0bcff]" /> Filter
            </button>
            <div className="flex -space-x-2 mr-2">
              {team.slice(0, 3).map((m, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-[#d0bcff] flex items-center justify-center text-[#3c0091] font-bold text-xs shadow-md border-2 border-[#131314]">
                  <User className="w-4 h-4 text-[#3c0091]" />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full bg-[#353436] flex items-center justify-center border-2 border-[#131314] text-[10px] font-bold text-[#cbc3d7]">
                +{team.length}
              </div>
            </div>
            <button className="bg-[#d0bcff] text-[#3c0091] px-4 py-2 rounded-xl text-xs font-bold hover:shadow-[0_0_15px_rgba(208,188,255,0.3)] transition-all flex items-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" /> New Column
            </button>
          </div>
        </div>

        {/* Board Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 py-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-[#93000a]/20 text-[#ffb4ab] text-xs font-medium border border-[#ffb4ab]/30">{error}</div>}
          <KanbanBoard tasks={filteredTasks} />
        </div>
      </div>
    </AppLayout>
  );
}
