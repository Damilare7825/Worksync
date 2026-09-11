import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { activityApi } from '../../api/activity.api.js';
import { getSocket } from '../../sockets/socket.js';
import { ActivityItem } from './ActivityItem.jsx';
import { ActivityFilters } from './ActivityFilters.jsx';

const SCOPE_TO_LOADER = {
  workspace: (id, params) => activityApi.listForWorkspace(id, params),
  project: (id, params) => activityApi.listForProject(id, params),
  task: (id, params) => activityApi.listForTask(id, params),
};

/**
 * Activity/history feed shared by workspace, project, and task-scoped
 * views (Phase 11). `scope` picks which endpoint to call; `scopeId` is the
 * workspace/project/task id. Handles pagination ("load more"), optional
 * action/audit filtering, loading/empty/error states, and live updates —
 * it listens for the existing `activity.created` socket event rather than
 * polling, so a feed already on screen updates itself without a refresh.
 */
export function ActivityFeed({ scope, scopeId, title = 'Activity', showFilters = true, showAuditToggle = false, compact = false }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [auditOnly, setAuditOnly] = useState(false);

  const loader = SCOPE_TO_LOADER[scope];
  // Filters changing should reset back to page 1, not append onto a list
  // fetched under different criteria.
  const filterKey = `${action}|${auditOnly}`;
  const filterKeyRef = useRef(filterKey);

  const fetchPage = useCallback(
    async (targetPage, { append } = { append: false }) => {
      if (!scopeId) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const params = { page: targetPage, limit: compact ? 10 : 20 };
        if (action) params.action = action;
        if (auditOnly) params.isAudit = 'true';
        const res = await loader(scopeId, params);
        setItems((prev) => (append ? [...prev, ...res.data.activity] : res.data.activity));
        setPage(res.meta.page);
        setTotalPages(res.meta.totalPages);
      } catch (err) {
        setError(err.message || 'Could not load activity');
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [scopeId, action, auditOnly, loader, compact]
  );

  useEffect(() => {
    filterKeyRef.current = filterKey;
    fetchPage(1, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, filterKey]);

  // Live updates: the backend broadcasts `activity.created` to the
  // workspace room always, and additionally to the project room when the
  // entry is project-scoped. A task-scoped feed piggybacks on the project
  // room broadcast (already joined elsewhere in the app) and filters by
  // taskId client-side, same pattern CommentSection uses for comments.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = ({ activity }) => {
      if (!activity) return;
      const matchesScope =
        (scope === 'workspace' && activity.workspaceId === scopeId) ||
        (scope === 'project' && activity.projectId === scopeId) ||
        (scope === 'task' && (activity.taskId === scopeId || (activity.entityType === 'TASK' && activity.entityId === scopeId)));
      if (!matchesScope) return;
      // Only merge live entries into an unfiltered, first-page view —
      // otherwise a live event could violate the current action/audit
      // filter and appear where it shouldn't.
      if (filterKeyRef.current !== '|false') return;
      setItems((prev) => (prev.some((i) => i.id === activity.id) ? prev : [activity, ...prev]));
    };

    socket.on('activity.created', handleCreated);
    return () => socket.off('activity.created', handleCreated);
  }, [scope, scopeId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{title}</h4>
        {showFilters && (
          <ActivityFilters
            action={action}
            onActionChange={setAction}
            auditOnly={auditOnly}
            onAuditOnlyChange={setAuditOnly}
            showAuditToggle={showAuditToggle}
          />
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchPage(1, { append: false })} className="font-semibold hover:underline">
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Loading activity...
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-slate-400 py-4 text-center">
          {action || auditOnly ? 'No activity matches these filters.' : 'No activity yet.'}
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className={compact ? 'max-h-72 overflow-y-auto pr-1 space-y-3' : 'space-y-3'}>
          {items.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {!loading && page < totalPages && (
        <button
          onClick={() => fetchPage(page + 1, { append: true })}
          disabled={loadingMore}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
