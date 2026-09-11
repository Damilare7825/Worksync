import React, { useMemo, useState } from 'react';
import { Plus, List, LayoutGrid, Search } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { TaskListView } from '../components/tasks/TaskListView';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { useWorkSync } from '../context/WorkSyncContext';
import { useAuth } from '../context/AuthContext.jsx';

const QUICK_VIEWS = [
  { id: 'all', label: 'All Tasks' },
  { id: 'mine', label: 'My Tasks' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Recently Completed' },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function Tasks() {
  const {
    tasks,
    statusFilter,
    priorityFilter,
    projectFilter,
    loading,
    error,
    setEditingTask,
    setTaskModalProject,
    setIsTaskModalOpen,
  } = useWorkSync();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [quickView, setQuickView] = useState('all');
  const [titleQuery, setTitleQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskModalProject(null);
    setIsTaskModalOpen(true);
  };

  const { today, soon } = useMemo(() => {
    const t = startOfDay(new Date());
    const s = new Date(t);
    s.setDate(s.getDate() + 3);
    return { today: t, soon: s };
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (titleQuery && !t.title.toLowerCase().includes(titleQuery.toLowerCase())) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;

      if (quickView === 'mine') return t.assigneeId === user?.id;
      if (quickView === 'due_soon') return t.status !== 'done' && t.due && startOfDay(t.due) >= today && startOfDay(t.due) <= soon;
      if (quickView === 'overdue') return t.status !== 'done' && t.due && startOfDay(t.due) < today;
      if (quickView === 'completed') return t.status === 'done';
      return true;
    });
  }, [tasks, titleQuery, statusFilter, priorityFilter, projectFilter, assigneeFilter, quickView, user, today, soon]);

  if (loading) {
    return (
      <AppLayout title="Tasks" subtitle="Manage, assign, and track operations across workspaces">
        <div className="h-64 flex items-center justify-center bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Tasks" subtitle="Manage, assign, and track operations across workspaces">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tasks</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage, assign, and track operations across workspaces</p>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button variant="primary" icon={Plus} onClick={handleCreateTask} className="flex-shrink-0">
                New Task
              </Button>
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium">{error}</div>}

          {/* Filters + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TaskFilters assigneeFilter={assigneeFilter} onAssigneeChange={setAssigneeFilter} />
            <div className="bg-white p-1 rounded-lg flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'board' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick view tabs */}
          <div className="flex items-center gap-5 border-b border-slate-200 -mt-2">
            {QUICK_VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setQuickView(v.id)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  quickView === v.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              icon="task"
              title="No tasks found"
              description="Adjust your filters or create a task to get started."
              actionLabel="Create Task"
              onAction={handleCreateTask}
            />
          ) : viewMode === 'list' ? (
            <TaskListView tasks={filteredTasks} />
          ) : (
            <KanbanBoard tasks={filteredTasks} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
