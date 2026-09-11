import React, { useEffect, useMemo } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import {
  FolderKanban,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Plus,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useWorkSync } from '../context/WorkSyncContext';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardApi } from '../api/dashboard.api.js';
import { ActivityFeed } from '../components/activity/ActivityFeed.jsx';
import { Badge } from '../components/common/Badge';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function MiniCalendar({ tasks }) {
  const today = startOfDay(new Date());

  // Real "this week" strip (Mon-Fri) built from actual task due dates,
  // rather than a decorative calendar with invented events.
  const monday = new Date(today);
  const day = monday.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMonday);

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const dueCountByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due) return;
      map[t.due] = (map[t.due] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm font-semibold text-slate-900 mb-4">{monthLabel}</p>
      <div className="grid grid-cols-5 gap-2 text-center">
        {days.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const isToday = d.getTime() === today.getTime();
          const dueCount = dueCountByDate[iso] || 0;
          return (
            <div key={iso} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold relative ${
                  isToday ? 'bg-blue-600 text-white' : dueCount > 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                }`}
              >
                {d.getDate()}
                {dueCount > 0 && !isToday && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, hint, accent }) {
  const accentCls = accent === 'red' ? 'border-red-200 bg-red-50/40' : 'border-slate-200';
  const iconCls =
    accent === 'red' ? 'text-red-500 bg-red-100' : accent === 'emerald' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50';
  const valueCls = accent === 'red' && value > 0 ? 'text-red-600' : 'text-slate-900';

  return (
    <div className={`bg-white rounded-xl border p-5 ${accentCls}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-3xl font-bold mt-3 tracking-tight ${valueCls}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

export function Dashboard() {
  const { tasks, projects, setIsTaskModalOpen, setIsProjectModalOpen, setIsInviteModalOpen, moveTaskStatus } = useWorkSync();
  const { user, activeWorkspaceId } = useAuth();

  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    dashboardApi.personal(activeWorkspaceId).catch(() => {});
    return undefined;
  }, [activeWorkspaceId]);

  const today = startOfDay(new Date());

  const totalProjects = projects.length;
  const activeTasksCount = tasks.filter((t) => t.status !== 'done').length;
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.due && startOfDay(t.due) < today);

  const myTasks = useMemo(() => tasks.filter((t) => t.status !== 'done').slice(0, 6), [tasks]);

  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <AppLayout title="Dashboard" subtitle="Overview of team productivity and active projects">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Good {greeting()}, {user?.name?.split(' ')[0] || 'there'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">{formattedDate}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" icon={UserPlus} onClick={() => setIsInviteModalOpen(true)}>
                Invite Member
              </Button>
              <Button variant="outline" size="sm" icon={Plus} onClick={() => setIsProjectModalOpen(true)}>
                New Project
              </Button>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsTaskModalOpen(true)}>
                New Task
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Projects" value={totalProjects} icon={FolderKanban} hint="Active this week" />
            <StatCard label="Active Tasks" value={activeTasksCount} icon={ListChecks} hint={`Across ${totalProjects || 1} project${totalProjects === 1 ? '' : 's'}`} />
            <StatCard label="Completed" value={completedCount} icon={CheckCircle2} hint="All time" accent="emerald" />
            <StatCard
              label="Overdue"
              value={overdueTasks.length}
              icon={AlertTriangle}
              hint={overdueTasks.length ? 'Requires attention' : 'Nothing overdue'}
              accent={overdueTasks.length ? 'red' : undefined}
            />
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">My Tasks</h2>
                <a href="/tasks" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Show All ({tasks.length}) <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {myTasks.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm font-semibold text-slate-700">You're all caught up</p>
                    <p className="text-xs text-slate-400 mt-1">No open tasks assigned to you right now.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {myTasks.map((task) => {
                      const isOverdue = task.due && startOfDay(task.due) < today;
                      return (
                        <li key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                          <button
                            onClick={() => moveTaskStatus(task.id, 'done')}
                            className="w-5 h-5 rounded border border-slate-300 hover:border-blue-500 flex items-center justify-center text-transparent hover:text-blue-500 transition-colors shrink-0 cursor-pointer"
                            title="Mark complete"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {task.project || 'General'} &middot; {task.due ? (isOverdue ? 'Overdue' : task.due) : 'No due date'}
                            </p>
                          </div>
                          <Badge type="priority" value={task.priority} />
                          <Avatar name={task.assignee} initials={task.initials} color={task.color} size="sm" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-slate-900">Activity</h2>
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <ActivityFeed scope="workspace" scopeId={activeWorkspaceId} compact showFilters={false} />
              </div>
              <MiniCalendar tasks={tasks} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
