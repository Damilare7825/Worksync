import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Repeat } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function WeekView({ tasks = [] }) {
  const { setEditingTask, setIsTaskModalOpen, updateTask } = useWorkSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [moveError, setMoveError] = useState('');

  // Calculate start of week (Sunday)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const prevWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() - 7);
    setCurrentDate(next);
  };

  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await updateTask(taskId, { due: dateStr });
    } catch (err) {
      setMoveError(err.message || 'Could not reschedule task');
      setTimeout(() => setMoveError(''), 3000);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const todayDateStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
      {/* Week Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
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
              onClick={prevWeek}
              className="p-1.5 hover:bg-slate-50 text-slate-600 border-r border-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextWeek}
              className="p-1.5 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {moveError && (
        <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">
          {moveError}
        </div>
      )}

      {/* 7 Days Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 min-h-[450px]">
        {weekDays.map((dayDate) => {
          const y = dayDate.getFullYear();
          const m = String(dayDate.getMonth() + 1).padStart(2, '0');
          const d = String(dayDate.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;

          const isToday = dateStr === todayDateStr;
          const dayTasks = tasks.filter((t) => t.due === dateStr);

          return (
            <div
              key={dateStr}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dateStr)}
              className={`bg-slate-50/60 rounded-xl p-3 border flex flex-col transition-colors min-h-[200px] ${
                isToday ? 'border-blue-400 bg-blue-50/20' : 'border-slate-200/60'
              }`}
            >
              {/* Day Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <p
                    className={`text-sm font-bold mt-0.5 ${
                      isToday ? 'text-blue-600' : 'text-slate-800'
                    }`}
                  >
                    {dayDate.getDate()}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200/60">
                  {dayTasks.length}
                </span>
              </div>

              {/* Tasks List for Day */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-medium border border-dashed border-slate-200 rounded-lg p-2 text-center">
                    Drag task here
                  </div>
                ) : (
                  dayTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                      onClick={() => {
                        setEditingTask(t);
                        setIsTaskModalOpen(true);
                      }}
                      className={`p-2.5 rounded-lg border text-xs font-semibold space-y-1 cursor-pointer shadow-2xs hover:shadow-sm transition-all ${getPriorityStyle(
                        t.priority
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate max-w-[110px] text-slate-900">{t.title}</span>
                        {t.recurrenceRule && <Repeat className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                      </div>
                      <p className="text-[10px] font-normal text-slate-500 truncate">{t.project}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
