import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
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

export function AgendaView({ tasks = [] }) {
  const { setEditingTask, setIsTaskModalOpen, updateTask } = useWorkSync();

  const groupedAgenda = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

    const groups = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      'This Week': [],
      Later: [],
      'No Due Date': [],
    };

    tasks.forEach((task) => {
      if (!task.due) {
        groups['No Due Date'].push(task);
        return;
      }

      // Parse YYYY-MM-DD
      const [y, m, d] = task.due.split('-').map(Number);
      const dueDate = new Date(y, m - 1, d);
      dueDate.setHours(0, 0, 0, 0);

      if (task.status !== 'completed' && dueDate < today) {
        groups.Overdue.push(task);
      } else if (dueDate.getTime() === today.getTime()) {
        groups.Today.push(task);
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        groups.Tomorrow.push(task);
      } else if (dueDate > tomorrow && dueDate <= endOfWeek) {
        groups['This Week'].push(task);
      } else {
        groups.Later.push(task);
      }
    });

    return groups;
  }, [tasks]);

  const handleStatusToggle = async (task, e) => {
    e.stopPropagation();
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch {
      // Reverted in context
    }
  };

  const groupColors = {
    Overdue: 'text-rose-600 bg-rose-50 border-rose-200',
    Today: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    Tomorrow: 'text-amber-600 bg-amber-50 border-amber-200',
    'This Week': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    Later: 'text-slate-600 bg-slate-50 border-slate-200',
    'No Due Date': 'text-slate-500 bg-slate-50 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedAgenda).map(([groupTitle, groupTasks]) => {
        if (groupTasks.length === 0) return null;

        const badgeClass = groupColors[groupTitle] || 'text-slate-600 bg-slate-50 border-slate-200';

        return (
          <div key={groupTitle} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${badgeClass}`}>
                {groupTitle}
              </span>
              <span className="text-xs font-medium text-slate-400">({groupTasks.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {groupTasks.map((task) => {
                const pBadge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
                const isDone = task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setEditingTask(task);
                      setIsTaskModalOpen(true);
                    }}
                    className={`bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer space-y-3 ${
                      isDone ? 'opacity-75 bg-slate-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Folder className="w-3 h-3 text-indigo-500" />
                        {task.project}
                      </span>
                      <div className="flex items-center gap-2">
                        {task.recurrenceRule && (
                          <span title="Recurring task" className="text-indigo-600">
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
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{task.due || 'No due date'}</span>
                      </div>

                      {task.assigneeObj && (
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            name={task.assigneeObj.name}
                            color={task.assigneeObj.color}
                            size="sm"
                          />
                          <span className="truncate max-w-[100px]">{task.assigneeObj.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
