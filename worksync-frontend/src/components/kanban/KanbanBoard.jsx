import React from 'react';
import { KANBAN_COLUMNS } from '../../data/uiConfig';
import { KanbanColumn } from './KanbanColumn';

export function KanbanBoard({ tasks = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 h-[calc(100vh-220px)] overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return <KanbanColumn key={col.id} column={col} tasks={colTasks} />;
      })}
    </div>
  );
}
