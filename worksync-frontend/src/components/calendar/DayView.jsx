import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Folder,
  Repeat,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { useWorkSync } from '../../context/WorkSyncContext';

const PRIORITY_BADGE = {
  urgent: { variant: 'danger', label: 'Urgent' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'info', label: 'Medium' },
  low: { variant: 'neutral', label: 'Low' },
};

export function DayView({ tasks = [] }) {
  const { setEditingTask, setIsTaskModalOpen, updateTask } = useWorkSync();
  const [currentDate, setCurrentDate] = useState(new Date());

  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const d = String(currentDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const dayTasks = tasks.filter((t) => t.due === dateStr);

  const prevDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const nextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  const handleStatusToggle = async (task, e) => {
    e.stopPropagation();
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch {
      // Reverted in context
    }
  };

  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
      {/* Day Navigation Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">{formattedDate}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={setToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={prevDay}
              className="p-1.5 hover:bg-slate-50 text-slate-600 border-r border-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextDay}
              className="p-1.5 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List for Selected Day */}
      {dayTasks.length === 0 ? (
        <div className="py-16 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
          <p className="text-sm font-semibold text-slate-600">No tasks scheduled for this day</p>
          <p className="text-xs text-slate-400">Tasks with due date on this date will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayTasks.map((task) => {
            const pBadge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                onClick={() => {
                  setEditingTask(task);
                  setIsTaskModalOpen(true);
                }}
                className={`bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer space-y-3 ${
                  isDone ? 'opacity-75 bg-slate-50/50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-blue-500" />
                    {task.project}
                  </span>
                  <div className="flex items-center gap-2">
                    {task.recurrenceRule && (
                      <span title="Recurring task" className="text-blue-600">
                        <Repeat className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <Badge variant={pBadge.variant}>{pBadge.label}</Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => handleStatusToggle(task, e)}
                    className={`mt-0.5 p-0.5 rounded-full border transition-colors ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-slate-400'
                    }`}
                    title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-semibold text-slate-900 leading-snug truncate ${
                        isDone ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Scheduled Date: {task.due}</span>
                  </div>

                  {task.assigneeObj && (
                    <div className="flex items-center gap-1.5">
                      <Avatar
                        name={task.assigneeObj.name}
                        color={task.assigneeObj.color}
                        size="sm"
                      />
                      <span className="truncate max-w-[120px]">{task.assigneeObj.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
