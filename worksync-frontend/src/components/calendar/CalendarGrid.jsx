import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function CalendarGrid({ tasks: propTasks }) {
  const { tasks: contextTasks, setEditingTask, setIsTaskModalOpen, updateTask } = useWorkSync();
  const tasks = propTasks || contextTasks;

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [moveError, setMoveError] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Monday-first week, matching the reference design.
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = [];
  const days = [];

  for (let i = 0; i < firstDayIndex; i++) {
    prevMonthDays.push(i);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const setToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const handleDrop = async (e, dateKey) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await updateTask(taskId, { due: dateKey });
    } catch (err) {
      setMoveError(err.message || 'Could not reschedule task');
      setTimeout(() => setMoveError(''), 3000);
    }
  };

  const getPriorityBg = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 text-red-700';
      case 'high':
        return 'bg-amber-50 text-amber-700';
      case 'medium':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-purple-50 text-purple-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between p-5 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-slate-900">
            {monthNames[month]} {year}
          </h1>
          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
            <button onClick={prevMonth} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={setToday} className="px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer">
              Today
            </button>
            <button onClick={nextMonth} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {moveError && (
        <div className="mx-5 mt-4 p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-xs font-medium">
          {moveError}
        </div>
      )}

      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100 flex-1 min-h-[500px]">
        {prevMonthDays.map((_, idx) => (
          <div key={`prev-${idx}`} className="bg-slate-50/60 p-2 min-h-[95px]" />
        ))}

        {days.map((day) => {
          const monthStr = String(month + 1).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dayStr}`;

          const dayTasks = tasks.filter((t) => t.due === dateKey);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

          return (
            <div
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dateKey)}
              className={`bg-white p-2 min-h-[95px] flex flex-col justify-between hover:bg-slate-50 transition-colors relative group ${
                isToday ? 'bg-blue-50/40' : ''
              }`}
            >
              <div className="flex justify-between items-center z-10 mb-1">
                <span
                  className={`text-xs font-semibold ${
                    isToday ? 'w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full' : 'text-slate-700'
                  }`}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && <span className="text-[10px] text-slate-400 font-semibold">{dayTasks.length}</span>}
              </div>

              <div className="space-y-1 mt-1 overflow-y-auto max-h-24">
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    onClick={() => {
                      setEditingTask(t);
                      setIsTaskModalOpen(true);
                    }}
                    className={`px-1.5 py-1 rounded text-[10px] font-medium truncate cursor-pointer transition-colors flex items-center justify-between gap-1 ${getPriorityBg(
                      t.priority
                    )} ${t.status === 'done' ? 'line-through opacity-60' : ''}`}
                    title={`${t.title} (${t.project || 'General'})`}
                  >
                    <span className="truncate">{t.title}</span>
                    {t.recurrenceRule && <Repeat className="w-3 h-3 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
