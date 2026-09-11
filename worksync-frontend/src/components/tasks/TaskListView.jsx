import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Edit,
  Trash2,
  ArrowUpDown,
  CheckSquare,
  Layers,
  Folder,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { useWorkSync } from '../../context/WorkSyncContext';
import { BulkActionsBar } from './BulkActionsBar';


const PRIORITY_BADGE = {
  urgent: { variant: 'danger', label: 'Urgent' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'info', label: 'Medium' },
  low: { variant: 'neutral', label: 'Low' },
};

const STATUS_BADGE = {
  todo: { variant: 'neutral', label: 'To Do' },
  in_progress: { variant: 'info', label: 'In Progress' },
  in_review: { variant: 'warning', label: 'In Review' },
  completed: { variant: 'success', label: 'Completed' },
  backlog: { variant: 'neutral', label: 'Backlog' },
};

export function TaskListView({ tasks = [] }) {
  const { setEditingTask, setIsTaskModalOpen, deleteTask, updateTask } = useWorkSync();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'status' | 'priority' | 'project'

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortDir]);

  // Grouped tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return { 'All Tasks': sortedTasks };

    const groups = {};
    sortedTasks.forEach((task) => {
      let key = 'Other';
      if (groupBy === 'status') key = STATUS_BADGE[task.status]?.label || task.status;
      else if (groupBy === 'priority') key = PRIORITY_BADGE[task.priority]?.label || task.priority;
      else if (groupBy === 'project') key = task.project || 'Unassigned Project';

      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    return groups;
  }, [sortedTasks, groupBy]);

  const handleStatusInline = async (task, newStatus) => {
    try {
      await updateTask(task.id, { status: newStatus });
    } catch {
      // Reverted in context
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Layers className="w-4 h-4 text-blue-500" />
          <span>Group By:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="project">Project</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-semibold text-slate-700">{tasks.length}</span> tasks
        </div>
      </div>

      {/* Task Table Groups */}
      {Object.entries(groupedTasks).map(([groupName, groupList]) => (
        <div key={groupName} className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {groupBy !== 'none' && (
            <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{groupName}</span>
              <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                {groupList.length}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === tasks.length && tasks.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-600 transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Task</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-600 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-600 transition-colors"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Assignee</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-600 transition-colors"
                    onClick={() => handleSort('due')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Due Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {groupList.map((task) => {
                  const isSelected = selectedIds.has(task.id);
                  const pBadge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(task.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Task Title */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="font-semibold text-slate-800 hover:text-blue-600 text-left transition-colors truncate max-w-xs"
                          >
                            {task.title}
                          </button>
                          {task.subtaskCompletedCount !== undefined && task._count?.subtasks > 0 && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <CheckSquare className="w-3 h-3" />
                              {task.subtaskCompletedCount}/{task._count.subtasks} subtasks
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusInline(task, e.target.value)}
                          className="bg-transparent border-0 font-semibold cursor-pointer text-xs focus:ring-0"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="in_review">In Review</option>
                          <option value="completed">Completed</option>
                          <option value="backlog">Backlog</option>
                        </select>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <Badge variant={pBadge.variant}>{pBadge.label}</Badge>
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4">
                        {task.assigneeObj ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={task.assigneeObj.name}
                              color={task.assigneeObj.color}
                              size="sm"
                            />
                            <span className="text-slate-700 truncate max-w-[120px]">
                              {task.assigneeObj.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4">
                        {task.due ? (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{task.due}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Project */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Folder className="w-3.5 h-3.5 text-blue-500" />
                          <span className="truncate max-w-[130px] font-medium">{task.project}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                            title="Edit task"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedTaskIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
