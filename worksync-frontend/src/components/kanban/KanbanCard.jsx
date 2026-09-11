import React from 'react';
import { Calendar, Edit, Trash2, MessageSquare, Paperclip, GripVertical } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useWorkSync } from '../../context/WorkSyncContext';

export function KanbanCard({ task }) {
  const { setEditingTask, setIsTaskModalOpen, deleteTask } = useWorkSync();
  const hasSubtasks = (task.subtaskCount || 0) > 0;
  const pct = hasSubtasks ? Math.round(((task.subtaskCompletedCount || 0) / task.subtaskCount) * 100) : 0;

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <span className="px-2 py-0.5 rounded bg-[#93000a]/20 text-[#ffb4ab] font-bold text-[9px] uppercase tracking-wider">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded bg-[#ca8100]/20 text-[#ffb95f] font-bold text-[9px] uppercase tracking-wider">Med</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-[#353436] text-[#cbc3d7] font-bold text-[9px] uppercase tracking-wider">Low</span>;
    }
  };

  return (
    <div className="bg-[#1c1b1c] p-4 rounded-xl border border-[#353436]/40 hover:border-[#a078ff]/40 transition-all cursor-grab active:cursor-grabbing group relative shadow-sm">
      {/* Drag handle & header */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-[#cbc3d7]/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="px-2 py-0.5 rounded bg-[#201f20] text-[#cbc3d7] font-semibold text-[10px] tracking-wider uppercase border border-[#353436]/40">
            {task.project || 'General'}
          </span>
        </div>
        {getPriorityBadge(task.priority)}
      </div>

      {/* Title */}
      <h3 className="font-bold text-xs text-[#e5e2e3] mb-3 leading-snug line-clamp-2">
        {task.title}
      </h3>

      {/* Progress Bar if Subtasks present */}
      {hasSubtasks && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-[#cbc3d7]">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#0e0e0f] rounded-full overflow-hidden border border-[#353436]/40">
            <div className="h-full bg-[#d0bcff] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Due Date tag */}
      {task.due && (
        <div className="flex items-center gap-1.5 mb-3 text-[#cbc3d7] font-mono text-[10px]">
          <Calendar className="w-3 h-3 text-[#cbc3d7]" />
          <span>{task.due}</span>
        </div>
      )}

      {/* Card Footer: Metadata & Assignee */}
      <div className="flex items-center justify-between pt-3 border-t border-[#353436]/30">
        <div className="flex items-center gap-3 text-[#cbc3d7]/70 text-[11px] font-semibold">
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{task.commentsCount || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" />
            <span>{task.attachmentsCount || 0}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={() => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
              className="p-1 rounded text-[#cbc3d7] hover:text-[#d0bcff] hover:bg-[#2a2a2b] transition-colors cursor-pointer"
              title="Edit task"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteTask(task.id).catch(() => {})}
              className="p-1 rounded text-[#cbc3d7] hover:text-rose-400 hover:bg-[#2a2a2b] transition-colors cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <Avatar name={task.assignee} initials={task.initials} color={task.color} size="sm" />
        </div>
      </div>
    </div>
  );
}
