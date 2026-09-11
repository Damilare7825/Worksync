import React, { useState } from 'react';
import { KanbanCard } from './KanbanCard';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function KanbanColumn({ column, tasks = [] }) {
  const { moveTaskStatus, setIsTaskModalOpen, setEditingTask } = useWorkSync();
  const [isDragOver, setIsDragOver] = useState(false);
  const [moveError, setMoveError] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await moveTaskStatus(taskId, column.id, null);
    } catch (err) {
      setMoveError(err.message || "You don't have permission to move this task");
      setTimeout(() => setMoveError(''), 3000);
    }
  };

  const handleDropOnCard = async (e, beforeTaskId) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId || taskId === beforeTaskId) return;
    try {
      await moveTaskStatus(taskId, column.id, beforeTaskId);
    } catch (err) {
      setMoveError(err.message || "You don't have permission to move this task");
      setTimeout(() => setMoveError(''), 3000);
    }
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleQuickAdd = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-[320px] flex flex-col max-h-full transition-colors ${
        isDragOver ? 'opacity-80' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-sm text-[#e5e2e3] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color || '#a078ff' }} />
            {column.label}
          </h2>
          <span className="text-[#cbc3d7] bg-[#201f20] px-2 py-0.5 rounded-full font-mono text-[10px] border border-[#353436]/40">
            {tasks.length}
          </span>
        </div>
        <button className="text-[#cbc3d7] hover:text-[#e5e2e3] cursor-pointer">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {moveError && (
        <div className="mb-2 px-2 py-1.5 rounded-xl bg-[#93000a]/20 text-[#ffb4ab] text-[11px] font-medium border border-[#ffb4ab]/30">
          {moveError}
        </div>
      )}

      {/* Task Cards List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4">
        {tasks.length === 0 ? (
          <div className="h-28 flex items-center justify-center border-2 border-dashed border-[#353436] rounded-xl text-xs text-[#cbc3d7]/60 font-medium">
            Drop task here
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnCard(e, task.id)}
            >
              <KanbanCard task={task} />
            </div>
          ))
        )}
      </div>

      {/* Add Task Action */}
      <button
        onClick={handleQuickAdd}
        className="mt-2 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[#cbc3d7] hover:bg-[#201f20] hover:text-[#e5e2e3] transition-colors text-xs font-semibold border border-transparent hover:border-[#353436] cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Add Task
      </button>
    </div>
  );
}
