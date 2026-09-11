import React, { useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { WeekView } from '../components/calendar/WeekView';
import { DayView } from '../components/calendar/DayView';
import { useWorkSync } from '../context/WorkSyncContext';
import { Badge } from '../components/common/Badge';
import { Avatar } from '../components/common/Avatar';
import { Clock, Filter } from 'lucide-react';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarPage() {
  const { tasks, projects, setEditingTask, setIsTaskModalOpen } = useWorkSync();

  const [viewMode, setViewMode] = useState('month');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredTasks = tasks.filter((t) => {
    if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  // Real "due today" list — the previous version of this page rendered a
  // hardcoded fake agenda (a "Team Standup" at a made-up 09:00 that no
  // task or event backs). Tasks don't carry a time-of-day, only a due
  // date, so this shows what's genuinely due today rather than
  // fabricating specific times.
  const dueToday = tasks.filter((t) => t.due === todayIso());

  const upcomingDeadlines = tasks
    .filter((t) => t.status !== 'done' && t.due && t.due >= todayIso())
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);

  const openTask = (t) => {
    setEditingTask(t);
    setIsTaskModalOpen(true);
  };

  return (
    <AppLayout title="Calendar" subtitle="Task timelines and deadline planning">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">
          <div className="flex-1 flex flex-col min-w-0 gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 ml-1" />
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                {['month', 'week', 'day'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                      viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'month' && <CalendarGrid tasks={filteredTasks} />}
            {viewMode === 'week' && <WeekView tasks={filteredTasks} />}
            {viewMode === 'day' && <DayView tasks={filteredTasks} />}
          </div>

          <div className="w-full xl:w-[320px] flex flex-col gap-4 shrink-0">
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-blue-600" /> Due Today
              </h3>
              {dueToday.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing due today.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dueToday.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t)}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <Avatar name={t.assignee} initials={t.initials} color={t.color} size="sm" />
                        <span className="text-xs font-medium text-slate-800 truncate">{t.title}</span>
                      </div>
                      <Badge type="priority" value={t.priority} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Upcoming Deadlines</h3>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-slate-400">No upcoming deadlines.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingDeadlines.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t)}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-xs font-medium text-slate-800 truncate">{t.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">{t.due}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
