import React, { useState } from 'react';
import { CheckSquare, X, ArrowRight, Flag, User, Loader2 } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';

const STATUS_OPTIONS = [
  { id: 'todo', label: 'To Do', api: 'TODO' },
  { id: 'in_progress', label: 'In Progress', api: 'IN_PROGRESS' },
  { id: 'in_review', label: 'In Review', api: 'IN_REVIEW' },
  { id: 'completed', label: 'Completed', api: 'COMPLETED' },
  { id: 'backlog', label: 'Backlog', api: 'BACKLOG' },
];

const PRIORITY_OPTIONS = [
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HIGH', label: 'High' },
  { id: 'URGENT', label: 'Urgent' },
];

export function BulkActionsBar({ selectedTaskIds = [], onClearSelection }) {
  const { bulkUpdateTasks, team = [] } = useWorkSync();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (selectedTaskIds.length === 0) return null;

  const handleStatusChange = async (e) => {
    const val = e.target.value;
    if (!val) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await bulkUpdateTasks({ taskIds: selectedTaskIds, status: val });
      onClearSelection();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriorityChange = async (e) => {
    const val = e.target.value;
    if (!val) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await bulkUpdateTasks({ taskIds: selectedTaskIds, priority: val });
      onClearSelection();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update priority');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssigneeChange = async (e) => {
    const val = e.target.value;
    if (!val) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await bulkUpdateTasks({
        taskIds: selectedTaskIds,
        assigneeId: val === 'unassigned' ? null : val,
      });
      onClearSelection();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 max-w-4xl w-[90%] transition-all animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700 font-semibold text-xs text-blue-400">
        <CheckSquare className="w-4 h-4" />
        <span>{selectedTaskIds.length} Selected</span>
      </div>

      {errorMsg && (
        <span className="text-xs text-rose-400 font-medium px-2 py-1 rounded bg-rose-950/60 border border-rose-800/60">
          {errorMsg}
        </span>
      )}

      {submitting ? (
        <div className="flex items-center gap-2 text-xs text-slate-300 px-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Updating tasks...</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-2.5 py-1.5 rounded-lg transition-colors">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <select
              onChange={handleStatusChange}
              defaultValue=""
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs font-medium"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                Change Status
              </option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st.id} value={st.api} className="bg-slate-900 text-slate-200">
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-2.5 py-1.5 rounded-lg transition-colors">
            <Flag className="w-3.5 h-3.5 text-slate-400" />
            <select
              onChange={handlePriorityChange}
              defaultValue=""
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs font-medium"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                Change Priority
              </option>
              {PRIORITY_OPTIONS.map((pr) => (
                <option key={pr.id} value={pr.id} className="bg-slate-900 text-slate-200">
                  {pr.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-2.5 py-1.5 rounded-lg transition-colors">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              onChange={handleAssigneeChange}
              defaultValue=""
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs font-medium max-w-[140px] truncate"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                Assign Member
              </option>
              <option value="unassigned" className="bg-slate-900 text-slate-300">
                Unassign
              </option>
              {team.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button
        onClick={onClearSelection}
        className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Clear Selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
