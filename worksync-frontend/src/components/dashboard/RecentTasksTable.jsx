import React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { ArrowRight, Edit, Trash2 } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function RecentTasksTable({ tasks = [] }) {
  const { moveTaskStatus, setEditingTask, setIsTaskModalOpen, deleteTask } = useWorkSync();

  return (
    <div className="glass-card rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-tight">Recent Tasks</h3>
          <p className="text-xs text-slate-400 mt-0.5">Overview of active work items</p>
        </div>
        <NavLink
          to="/tasks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/60 border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-3">Task</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-500">
                  No tasks found
                </td>
              </tr>
            ) : (
              tasks.slice(0, 6).map((task) => (
                <tr key={task.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-6 py-3.5">
                    <p className="font-semibold text-slate-100 line-clamp-1">{task.title}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-400 font-medium">{task.project}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge type="priority" value={task.priority} />
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={task.status}
                      onChange={(e) => moveTaskStatus(task.id, e.target.value)}
                      className="text-xs font-medium bg-slate-900 border border-slate-700/50 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-200"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-mono text-slate-400">{task.due}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={task.assignee}
                        initials={task.initials}
                        color={task.color}
                        size="sm"
                      />
                      <span className="text-xs text-slate-300 truncate">{task.assignee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit task"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
