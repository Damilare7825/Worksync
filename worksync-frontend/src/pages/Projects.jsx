import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Plus, Search, Archive } from 'lucide-react';
import { useWorkSync } from '../context/WorkSyncContext';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../api/project.api.js';
import { EmptyState } from '../components/common/EmptyState';
import { initialsOf, colorForId } from '../utils/taskMapping.js';

export function Projects() {
  const { projects, tasks, setIsProjectModalOpen, searchQuery, setSearchQuery, loading, error } = useWorkSync();
  const { activeMembership, activeWorkspaceId } = useAuth();
  const navigate = useNavigate();
  const canCreate = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  // Real per-project member rosters. The workspace-wide project list
  // endpoint doesn't embed members (see project.service.js's listProjects
  // — it returns bare rows), but the per-project members endpoint already
  // does, so this reuses that instead of asking the backend to change.
  const [membersByProject, setMembersByProject] = useState({});

  useEffect(() => {
    if (!showArchived || !activeWorkspaceId) return;
    setArchivedLoading(true);
    projectApi
      .list(activeWorkspaceId, { status: 'ARCHIVED', limit: 100 })
      .then((res) => setArchivedProjects(res.data.projects))
      .finally(() => setArchivedLoading(false));
  }, [showArchived, activeWorkspaceId]);

  const baseProjects = showArchived ? archivedProjects : projects;

  useEffect(() => {
    let cancelled = false;
    const toFetch = baseProjects.filter((p) => !(p.id in membersByProject));
    if (toFetch.length === 0) return undefined;
    Promise.all(
      toFetch.map((p) =>
        projectApi
          .listMembers(p.id)
          .then((res) => [p.id, res.data.members])
          .catch(() => [p.id, []]),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setMembersByProject((prev) => {
        const next = { ...prev };
        pairs.forEach(([id, members]) => {
          next[id] = members;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // Only re-run when the visible project set actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProjects]);

  const taskCountsByProject = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.projectId) return;
      if (!map[t.projectId]) map[t.projectId] = { completed: 0, total: 0 };
      map[t.projectId].total += 1;
      if (t.status === 'done') map[t.projectId].completed += 1;
    });
    return map;
  }, [tasks]);

  const filteredProjects = baseProjects.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    if (filterTab === 'ACTIVE') return p.status === 'ACTIVE';
    if (filterTab === 'COMPLETED') return p.status === 'COMPLETED';
    return true;
  });

  if (loading && !showArchived) {
    return (
      <AppLayout title="Projects" subtitle="Manage and track your active initiatives.">
        <div className="h-64 flex items-center justify-center bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Projects" subtitle="Manage and track your active initiatives.">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track your active initiatives.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  showArchived ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? 'Viewing Archived' : 'Archive'}
              </button>

              {canCreate && !showArchived && (
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> New Project
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: 'Active' },
              { id: 'COMPLETED', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

          {showArchived && archivedLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon="project"
              title={showArchived ? 'No archived projects' : 'No projects found'}
              description={
                showArchived
                  ? 'Projects you archive will show up here.'
                  : canCreate
                  ? 'Create your first project to get started.'
                  : 'Ask a workspace admin to create one.'
              }
              actionLabel={!showArchived && canCreate ? 'New Project' : undefined}
              onAction={!showArchived && canCreate ? () => setIsProjectModalOpen(true) : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const counts = taskCountsByProject[project.id] || { completed: 0, total: 0 };
                const rawMembers = membersByProject[project.id] || [];
                const members = rawMembers.map((m) => ({
                  name: m.user.name,
                  initials: initialsOf(m.user.name),
                  color: colorForId(m.user.id),
                }));
                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    completed={counts.completed}
                    total={counts.total}
                    members={members}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
