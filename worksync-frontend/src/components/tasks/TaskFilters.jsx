import React from 'react';
import { useWorkSync } from '../../context/WorkSyncContext';

export function TaskFilters({ assigneeFilter, onAssigneeChange }) {
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    projectFilter,
    setProjectFilter,
    projects,
    team,
  } = useWorkSync();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterPill label="Status" value={statusFilter} onChange={setStatusFilter}>
        <option value="all">All</option>
        <option value="backlog">Backlog</option>
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="review">In Review</option>
        <option value="done">Completed</option>
      </FilterPill>

      <FilterPill label="Priority" value={priorityFilter} onChange={setPriorityFilter}>
        <option value="all">All</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </FilterPill>

      {onAssigneeChange && (
        <FilterPill label="Assignee" value={assigneeFilter} onChange={onAssigneeChange}>
          <option value="all">All</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </FilterPill>
      )}

      <FilterPill label="Project" value={projectFilter} onChange={setProjectFilter}>
        <option value="all">All</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </FilterPill>
    </div>
  );
}

function FilterPill({ label, value, onChange, children }) {
  return (
    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:border-slate-300 transition-colors">
      <span className="text-slate-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
      >
        {children}
      </select>
    </label>
  );
}
