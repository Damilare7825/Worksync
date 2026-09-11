import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, Eye, EyeOff, GitBranch, Repeat, ListChecks, Tag } from 'lucide-react';
import { taskApi, labelApi } from '../../api/task.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkSync } from '../../context/WorkSyncContext';
import { STATUS_TO_UI } from '../../utils/taskMapping.js';
import { AttachmentList } from '../attachments/AttachmentList.jsx';


const LABEL_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#EC4899', '#8B5CF6'];

/**
 * Fetches the full (Phase 14) task detail — subtasks, checklist, labels,
 * watchers, dependencies, recurrence — once per taskId. Kept separate
 * from WorkSyncContext's lighter `tasks` list (which the Kanban/board
 * views use) since this richer shape is only needed while a task is open
 * in the modal.
 */
function useFullTask(taskId) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await taskApi.get(taskId);
      setFull(res.data.task);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { full, loading, reload };
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      {title}
      {count !== undefined && <span className="text-slate-400 normal-case font-medium">({count})</span>}
    </h4>
  );
}

function ChecklistSection({ taskId, full, reload, onError }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const items = full.checklistItems || [];
  const done = items.filter((i) => i.completed).length;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await taskApi.addChecklistItem(taskId, text.trim());
      setText('');
      await reload();
    } catch (err) {
      onError(err.message || 'Could not add checklist item');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    try {
      await taskApi.updateChecklistItem(item.id, { completed: !item.completed });
      await reload();
    } catch (err) {
      onError(err.message || 'Could not update checklist item');
    }
  };

  const remove = async (item) => {
    try {
      await taskApi.deleteChecklistItem(item.id);
      await reload();
    } catch (err) {
      onError(err.message || 'Could not delete checklist item');
    }
  };

  return (
    <div className="space-y-2">
      <SectionHeader icon={ListChecks} title="Checklist" count={items.length ? `${done}/${items.length}` : undefined} />
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggle(item)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`flex-1 text-xs ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
              {item.text}
            </span>
            <button
              onClick={() => remove(item)}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add checklist item..."
          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

function LabelsSection({ taskId, full, reload, onError }) {
  const { activeWorkspaceId } = useAuth();
  const [allLabels, setAllLabels] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!activeWorkspaceId) return;
    labelApi.list(activeWorkspaceId).then((res) => setAllLabels(res.data.labels));
  }, [activeWorkspaceId]);

  const taskLabelIds = new Set((full.labels || []).map((l) => l.id));

  const toggleLabel = async (label) => {
    try {
      if (taskLabelIds.has(label.id)) {
        await taskApi.removeLabel(taskId, label.id);
      } else {
        await taskApi.addLabel(taskId, label.id);
      }
      await reload();
    } catch (err) {
      onError(err.message || 'Could not update label');
    }
  };

  const createLabel = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const color = LABEL_COLORS[allLabels.length % LABEL_COLORS.length];
      const res = await labelApi.create(activeWorkspaceId, { name: newName.trim(), color });
      setAllLabels((prev) => [...prev, res.data.label]);
      setNewName('');
      setCreating(false);
    } catch (err) {
      onError(err.message || 'Could not create label');
    }
  };

  return (
    <div className="space-y-2">
      <SectionHeader icon={Tag} title="Labels" />
      <div className="flex flex-wrap gap-1.5">
        {allLabels.map((label) => {
          const active = taskLabelIds.has(label.id);
          return (
            <button
              key={label.id}
              type="button"
              onClick={() => toggleLabel(label)}
              className="text-[11px] font-semibold px-2 py-1 rounded-full border transition-all"
              style={
                active
                  ? { backgroundColor: `${label.color}20`, borderColor: label.color, color: label.color }
                  : { backgroundColor: 'white', borderColor: '#E2E8F0', color: '#94A3B8' }
              }
            >
              {label.name}
            </button>
          );
        })}
        {creating ? (
          <form onSubmit={createLabel} className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName && setCreating(false)}
              placeholder="Label name"
              className="w-24 px-2 py-1 text-[11px] border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-[11px] font-semibold px-2 py-1 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400"
          >
            + New label
          </button>
        )}
      </div>
    </div>
  );
}

function WatchersSection({ taskId, full, reload, onError }) {
  const { user } = useAuth();
  const watcherIds = full.watcherIds || [];
  const isWatching = watcherIds.includes(user?.id);

  const toggle = async () => {
    try {
      if (isWatching) await taskApi.unwatch(taskId);
      else await taskApi.watch(taskId);
      await reload();
    } catch (err) {
      onError(err.message || 'Could not update watch status');
    }
  };

  return (
    <div className="flex items-center justify-between">
      <SectionHeader icon={isWatching ? Eye : EyeOff} title="Watching" count={watcherIds.length} />
      <button
        type="button"
        onClick={toggle}
        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
          isWatching
            ? 'bg-blue-50 border-blue-200 text-blue-600'
            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
        }`}
      >
        {isWatching ? 'Watching' : 'Watch'}
      </button>
    </div>
  );
}

function SubtasksSection({ taskId, projectId, full, reload, onError }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const subtasks = full.subtasks || [];

  const addSubtask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await taskApi.create(projectId, { title: title.trim(), parentTaskId: taskId });
      setTitle('');
      await reload();
    } catch (err) {
      onError(err.message || 'Could not add subtask');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <SectionHeader icon={ListChecks} title="Subtasks" count={subtasks.length || undefined} />
      <div className="space-y-1">
        {subtasks.map((st) => (
          <div key={st.id} className="flex items-center gap-2 text-xs text-slate-700">
            <span
              className={`w-1.5 h-1.5 rounded-full ${st.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`}
            />
            <span className={st.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}>{st.title}</span>
          </div>
        ))}
      </div>
      <form onSubmit={addSubtask} className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add subtask..."
          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

function DependenciesSection({ taskId, projectId, full, reload, onError }) {
  const { tasks } = useWorkSync();
  const [selected, setSelected] = useState('');
  const dependencies = full.dependencies || [];
  const dependents = full.dependents || [];

  const candidateTasks = tasks.filter(
    (t) => t.projectId === projectId && t.id !== taskId && !dependencies.some((d) => d.task.id === t.id)
  );

  const addDep = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await taskApi.addDependency(taskId, selected);
      setSelected('');
      await reload();
    } catch (err) {
      onError(err.message || 'Could not add dependency');
    }
  };

  const removeDep = async (depTaskId) => {
    try {
      await taskApi.removeDependency(taskId, depTaskId);
      await reload();
    } catch (err) {
      onError(err.message || 'Could not remove dependency');
    }
  };

  return (
    <div className="space-y-2">
      <SectionHeader icon={GitBranch} title="Dependencies" />
      {dependencies.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400">Depends on:</p>
          {dependencies.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs text-slate-700">
              <span>{d.task.title}</span>
              <button onClick={() => removeDep(d.task.id)} className="text-slate-300 hover:text-rose-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {dependents.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400">Blocks:</p>
          {dependents.map((d) => (
            <div key={d.id} className="text-xs text-slate-700">
              {d.task.title}
            </div>
          ))}
        </div>
      )}
      {candidateTasks.length > 0 && (
        <form onSubmit={addDep} className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Add dependency...</option>
            {candidateTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selected}
            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

function RecurrenceSection({ taskId, full, reload, onError }) {
  const rule = full.recurrenceRule;
  const [pattern, setPattern] = useState(rule?.pattern || 'WEEKLY');
  const [interval, setInterval] = useState(rule?.interval || 1);

  const save = async () => {
    try {
      await taskApi.setRecurrence(taskId, { pattern, interval: Number(interval) });
      await reload();
    } catch (err) {
      onError(err.message || 'Could not set recurrence');
    }
  };

  const remove = async () => {
    try {
      await taskApi.removeRecurrence(taskId);
      await reload();
    } catch (err) {
      onError(err.message || 'Could not remove recurrence');
    }
  };

  return (
    <div className="space-y-2">
      <SectionHeader icon={Repeat} title="Recurrence" />
      {rule ? (
        <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5">
          <span>
            Every {rule.interval > 1 ? `${rule.interval} ` : ''}
            {rule.pattern === 'DAILY' ? (rule.interval > 1 ? 'days' : 'day') : ''}
            {rule.pattern === 'WEEKLY' ? (rule.interval > 1 ? 'weeks' : 'week') : ''}
            {rule.pattern === 'MONTHLY' ? (rule.interval > 1 ? 'months' : 'month') : ''}
          </span>
          <button onClick={remove} className="text-slate-400 hover:text-rose-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <input
            type="number"
            min={1}
            max={365}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
          />
          <button
            onClick={save}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
          >
            Set recurring
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Everything Phase 14 adds to the task modal, laid out as compact
 * sections. Only rendered for an existing task (a task being created has
 * no id yet for any of these to attach to).
 */
export function TaskAdvancedSections({ taskId, projectId }) {
  const { full, loading, reload } = useFullTask(taskId);
  const [error, setError] = useState('');

  if (loading || !full) {
    return <div className="text-xs text-slate-400 py-2">Loading task details...</div>;
  }

  return (
    <div className="space-y-5 pt-4 border-t border-slate-100">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}
      <WatchersSection taskId={taskId} full={full} reload={reload} onError={setError} />
      <LabelsSection taskId={taskId} full={full} reload={reload} onError={setError} />
      <ChecklistSection taskId={taskId} full={full} reload={reload} onError={setError} />
      {!full.parentTaskId && (
        <SubtasksSection taskId={taskId} projectId={projectId} full={full} reload={reload} onError={setError} />
      )}
      <DependenciesSection taskId={taskId} projectId={projectId} full={full} reload={reload} onError={setError} />
      <RecurrenceSection taskId={taskId} full={full} reload={reload} onError={setError} />
      <div className="pt-3 border-t border-slate-100">
        <AttachmentList taskId={taskId} />
      </div>
    </div>

  );
}
