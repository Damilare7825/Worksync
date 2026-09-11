import React from 'react';
import { Select } from '../common/Input';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'TASK_CREATED', label: 'Task created' },
  { value: 'TASK_UPDATED', label: 'Task updated' },
  { value: 'TASK_STATUS_CHANGED', label: 'Task status changed' },
  { value: 'TASK_PRIORITY_CHANGED', label: 'Task priority changed' },
  { value: 'TASK_ASSIGNED', label: 'Task assigned' },
  { value: 'TASK_DELETED', label: 'Task deleted' },
  { value: 'COMMENT_ADDED', label: 'Comment added' },
  { value: 'COMMENT_EDITED', label: 'Comment edited' },
  { value: 'COMMENT_DELETED', label: 'Comment deleted' },
  { value: 'PROJECT_CREATED', label: 'Project created' },
  { value: 'PROJECT_UPDATED', label: 'Project updated' },
  { value: 'PROJECT_MEMBER_ADDED', label: 'Project member added' },
  { value: 'WORKSPACE_MEMBER_ROLE_CHANGED', label: 'Member role changed' },
  { value: 'WORKSPACE_MEMBER_REMOVED', label: 'Member removed' },
  { value: 'USER_INVITED', label: 'User invited' },
];

export function ActivityFilters({ action, onActionChange, auditOnly, onAuditOnlyChange, showAuditToggle }) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={action}
        onChange={(e) => onActionChange(e.target.value)}
        options={ACTION_OPTIONS}
        className="text-xs"
      />
      {showAuditToggle && (
        <button
          type="button"
          onClick={() => onAuditOnlyChange(!auditOnly)}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
            auditOnly
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
        >
          Audit only
        </button>
      )}
    </div>
  );
}
