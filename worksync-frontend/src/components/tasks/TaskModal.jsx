import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { SearchableSelect } from '../common/SearchableSelect';
import { CommentSection } from './CommentSection.jsx';
import { ActivityFeed } from '../activity/ActivityFeed.jsx';
import { TaskAdvancedSections } from './TaskAdvancedSections.jsx';
import { useWorkSync } from '../../context/WorkSyncContext';
import { projectApi } from '../../api/project.api.js';

const emptyForm = (lockedProjectId) => ({
  title: '',
  description: '',
  projectId: lockedProjectId || '',
  priority: 'medium',
  status: 'todo',
  due: '',
  assigneeId: '',
});

export function TaskModal() {
  const {
    isTaskModalOpen,
    setIsTaskModalOpen,
    editingTask,
    taskModalProject,
    setTaskModalProject,
    addTask,
    updateTask,
    projects,
  } = useWorkSync();

  const isLocked = Boolean(taskModalProject) && !editingTask;
  const [formData, setFormData] = useState(emptyForm(taskModalProject?.id));
  // Snapshot of the form as it looked when the task was loaded, so Save
  // can send only what actually changed. This matters beyond tidiness: a
  // plain Member who is the task's assignee is only permitted to change
  // `status` (see task.service.js's ASSIGNEE_ALLOWED_FIELDS) — sending
  // the whole form back, untouched fields included, gets that legitimate
  // status update rejected as if they'd tried to edit everything else too.
  const [initialFormData, setInitialFormData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Assignee choices always come from the *selected project's* members,
  // never the full workspace roster — someone outside the project isn't a
  // valid assignee even if they're a workspace member.
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isTaskModalOpen) return;
    setError('');
    if (editingTask) {
      const snapshot = {
        title: editingTask.title || '',
        description: editingTask.description || '',
        projectId: editingTask.projectId || '',
        priority: editingTask.priority || 'medium',
        status: editingTask.status || 'todo',
        due: editingTask.due || '',
        assigneeId: editingTask.assigneeId || '',
      };
      setFormData(snapshot);
      setInitialFormData(snapshot);
    } else {
      setInitialFormData(null);
      // Global create must NOT auto-select a project — the user picks one
      // explicitly. Project-specific create pre-fills the locked project.
      setFormData(emptyForm(taskModalProject?.id));
    }
  }, [editingTask, isTaskModalOpen, taskModalProject]);

  // Load the current project's members whenever the selected project
  // changes, and drop an assignee that's no longer valid for it.
  useEffect(() => {
    if (!formData.projectId) {
      setProjectMembers([]);
      return;
    }
    let cancelled = false;
    setLoadingMembers(true);
    projectApi
      .listMembers(formData.projectId)
      .then((res) => {
        if (cancelled) return;
        const members = res.data.members;
        setProjectMembers(members);
        setFormData((prev) => {
          if (prev.assigneeId && !members.some((m) => m.user.id === prev.assigneeId)) {
            return { ...prev, assigneeId: '' };
          }
          return prev;
        });
      })
      .catch(() => {
        if (!cancelled) setProjectMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.projectId]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.title.trim() || !formData.projectId) return;

    setLoading(true);
    setError('');
    try {
      if (editingTask) {
        // Only send fields that actually changed from what was loaded —
        // see the initialFormData comment above for why this matters
        // beyond just being tidy over the wire.
        const changed = {};
        for (const key of Object.keys(formData)) {
          if (key === 'projectId') continue; // never editable here
          if (formData[key] !== initialFormData?.[key]) changed[key] = formData[key];
        }
        if (Object.keys(changed).length === 0) {
          close();
          return;
        }
        await updateTask(editingTask.id, changed);
      } else {
        await addTask(formData);
      }
      close();
    } catch (err) {
      setError(err.message || 'Could not save task');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setIsTaskModalOpen(false);
    setTaskModalProject(null);
  };

  const lockedProjectName =
    taskModalProject?.name || projects.find((p) => p.id === formData.projectId)?.name || '';

  return (
    <Modal
      isOpen={isTaskModalOpen}
      onClose={close}
      title={editingTask ? 'Edit Task' : 'Create New Task'}
      maxWidth="max-w-4xl"
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: title, description, and — once the task exists —
            subtasks/attachments/comments/history. */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Input
            label="Task Title"
            placeholder="e.g. Build authentication API"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Add task details, acceptance criteria, or context..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Comments only make sense once a task actually exists — a task
              being created has no id yet to attach comments to. */}
          {editingTask && (
            <div className="flex flex-col gap-5 pt-2 border-t border-slate-100">
              <TaskAdvancedSections taskId={editingTask.id} projectId={editingTask.projectId} />
              <CommentSection taskId={editingTask.id} projectId={editingTask.projectId} />
              <div className="pt-4 border-t border-slate-100">
                <ActivityFeed scope="task" scopeId={editingTask.id} title="History" showFilters={false} compact />
              </div>
            </div>
          )}
        </div>

        {/* Right column: a "Details" panel mirroring the task-detail
            reference design — status/priority/assignee/due/project all
            live-editable, subject to the same permission rules as before. */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4 sticky top-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Details</p>

            {isLocked || editingTask ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Project</label>
                <div className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
                  {lockedProjectName || '—'}
                </div>
              </div>
            ) : (
              <SearchableSelect
                label="Project"
                required
                value={formData.projectId}
                onChange={(projectId) => setFormData({ ...formData, projectId, assigneeId: '' })}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Search projects..."
              />
            )}

            {/* Status is only ever shown/edited on an existing task — never
                on create, where the backend always defaults to TODO. */}
            {editingTask && (
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'backlog', label: 'Backlog' },
                  { value: 'todo', label: 'To Do' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'review', label: 'In Review' },
                  { value: 'done', label: 'Completed' },
                ]}
              />
            )}

            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />

            <Select
              label="Assignee"
              value={formData.assigneeId}
              onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
              disabled={!formData.projectId || loadingMembers}
              options={[
                {
                  value: '',
                  label: !formData.projectId
                    ? 'Select a project first'
                    : loadingMembers
                    ? 'Loading members...'
                    : 'Unassigned',
                },
                ...projectMembers.map((m) => ({ value: m.user.id, label: m.user.name })),
              ]}
            />

            <Input
              label="Due Date"
              type="date"
              value={formData.due}
              onChange={(e) => setFormData({ ...formData, due: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Save/Cancel live at the true bottom of the modal, below every
          section, rather than sandwiched between the basic fields and the
          advanced sections — regardless of how much content an existing
          task has (checklist, comments, history), the actions stay in the
          same predictable place. */}
      <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-100 sticky bottom-0 bg-white">
        <Button type="button" variant="outline" onClick={close} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={() => handleSubmit()} disabled={loading || !formData.projectId}>
          {loading ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </Modal>
  );
}
