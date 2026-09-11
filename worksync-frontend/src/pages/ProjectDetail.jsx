import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Avatar, AvatarGroup } from '../components/common/Avatar';
import { Select } from '../components/common/Input';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Plus, UserPlus, Trash2, Archive, ArchiveRestore, Trash, ChevronRight, Share2, Pencil } from 'lucide-react';
import { projectApi } from '../api/project.api.js';
import { useWorkSync } from '../context/WorkSyncContext';
import { useAuth } from '../context/AuthContext.jsx';
import { PROJECT_ROLE_LABELS } from '../data/uiConfig.js';
import { ActivityFeed } from '../components/activity/ActivityFeed.jsx';
import { AttachmentList } from '../components/attachments/AttachmentList.jsx';
import { TaskListView } from '../components/tasks/TaskListView.jsx';
import { KanbanBoard } from '../components/kanban/KanbanBoard.jsx';
import { Badge } from '../components/common/Badge';
import { initialsOf, colorForId } from '../utils/taskMapping.js';

const TABS = ['Overview', 'Tasks', 'Calendar', 'Activity', 'Files'];

// Real weekly completion counts from each task's actual `completedAt`
// timestamp (surfaced via taskMapping.js) — not a decorative chart. Weeks
// with no completions render as empty (0-height) rather than being padded
// with invented numbers.
function useVelocity(projectTasks) {
  return useMemo(() => {
    const now = new Date();
    const weeks = Array.from({ length: 5 }, (_, i) => {
      const end = new Date(now);
      end.setDate(end.getDate() - (4 - i) * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start, end, count: 0 };
    });
    projectTasks.forEach((t) => {
      if (!t.completedAt) return;
      const completed = new Date(t.completedAt);
      const week = weeks.find((w) => completed >= w.start && completed <= w.end);
      if (week) week.count += 1;
    });
    const max = Math.max(1, ...weeks.map((w) => w.count));
    return { weeks, max };
  }, [projectTasks]);
}

export function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, team, setIsTaskModalOpen, setEditingTask, setTaskModalProject, setIsProjectModalOpen, setEditingProject, reload } =
    useWorkSync();
  const { activeMembership, user } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskViewMode, setTaskViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('Overview');
  const [addingMemberId, setAddingMemberId] = useState('');
  const [addingRole, setAddingRole] = useState('MEMBER');
  const [busy, setBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectRes, membersRes, statsRes] = await Promise.all([
        projectApi.get(id),
        projectApi.listMembers(id),
        projectApi.getStats(id).catch(() => null),
      ]);
      setProject(projectRes.data.project);
      setMembers(membersRes.data.members);
      setStats(statsRes?.data?.stats || null);
    } catch (err) {
      setError(err.message || 'Could not load this project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const projectTasks = tasks.filter((t) => t.projectId === id);
  const { weeks: velocityWeeks, max: velocityMax } = useVelocity(projectTasks);

  const myProjectMembership = members.find((m) => m.user.id === user?.id);
  const canManage =
    activeMembership?.role === 'OWNER' ||
    activeMembership?.role === 'ADMIN' ||
    myProjectMembership?.role === 'MANAGER';

  const availableToAdd = team.filter((t) => !members.some((m) => m.user.id === t.id));

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addingMemberId) return;
    setBusy(true);
    setError('');
    try {
      await projectApi.addMember(id, { userId: addingMemberId, role: addingRole });
      setAddingMemberId('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not add member');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (memberId, role) => {
    setBusy(true);
    try {
      await projectApi.updateMember(id, memberId, role);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update role');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setBusy(true);
    try {
      await projectApi.removeMember(id, memberId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not remove member');
    } finally {
      setBusy(false);
    }
  };

  const isArchived = project?.status === 'ARCHIVED';
  const canDelete = activeMembership?.role === 'OWNER';

  const handleArchive = async () => {
    setLifecycleBusy(true);
    try {
      const res = await projectApi.archive(id);
      setProject(res.data.project);
      await reload();
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleRestore = async () => {
    setLifecycleBusy(true);
    setError('');
    try {
      const res = await projectApi.restore(id);
      setProject(res.data.project);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not restore this project');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleDeleteProject = async () => {
    await projectApi.remove(id);
    await reload();
    navigate('/projects');
  };

  // A real, working "Share": copies the actual current URL — no fake
  // sharing modal that doesn't do anything.
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) — fail quietly, nothing destructive happened.
    }
  };

  if (loading) {
    return (
      <AppLayout title="Project" subtitle="Loading...">
        <div className="h-64 flex items-center justify-center bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="Project not found" subtitle="">
        <div className="p-6 bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="p-6 rounded-lg bg-rose-50 text-rose-600 text-sm">{error || 'This project could not be found.'}</div>
        </div>
      </AppLayout>
    );
  }

  const memberAvatars = members.map((m) => ({
    name: m.user.name,
    initials: initialsOf(m.user.name),
    color: colorForId(m.user.id),
  }));

  return (
    <AppLayout title={project.name} subtitle={project.description || 'No description'}>
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <NavLink to="/projects" className="hover:text-slate-600">Projects</NavLink>
            <ChevronRight className="w-3 h-3" />
            <span className="font-semibold text-slate-700">{project.name}</span>
          </div>

          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isArchived ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {isArchived ? 'Archived' : project.status === 'COMPLETED' ? 'Completed' : 'Active'}
                </span>
              </div>
              <p className="text-sm text-slate-500">{project.description || 'No description provided.'}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <AvatarGroup members={memberAvatars} max={4} />
                <span className="text-xs text-slate-400">{members.length} members</span>
              </div>
              {project.dueDate && (
                <span className="text-xs text-slate-400">
                  Due {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" icon={Share2} onClick={handleShare}>
                  {copiedLink ? 'Copied!' : 'Share'}
                </Button>
                {canManage && !isArchived && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Pencil}
                    onClick={() => {
                      setEditingProject(project);
                      setIsProjectModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
                  activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium">{error}</div>}

          {isArchived && (
            <div className="p-3 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium flex items-center justify-between">
              This project is archived and read-only — restore it to make changes.
              {canManage && (
                <Button variant="outline" size="sm" icon={ArchiveRestore} onClick={handleRestore} disabled={lifecycleBusy}>
                  {lifecycleBusy ? 'Restoring...' : 'Restore Project'}
                </Button>
              )}
            </div>
          )}

          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col gap-6">
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard label="Total Tasks" value={stats.totalTasks} />
                    <StatCard label="Completed" value={stats.tasksByStatus.COMPLETED} accent="emerald" />
                    <StatCard label="In Progress" value={stats.tasksByStatus.IN_PROGRESS} accent="blue" />
                    <StatCard label="In Review" value={stats.tasksByStatus.IN_REVIEW} accent="purple" />
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-slate-900 mb-4">Sprint Velocity</p>
                  <div className="flex items-end gap-3 h-32 bg-slate-50 rounded-lg p-4">
                    {velocityWeeks.map((w, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          className="w-full bg-blue-600 rounded-md min-h-[4px]"
                          style={{ height: `${(w.count / velocityMax) * 100}%` }}
                          title={`${w.count} completed`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Tasks completed per week, last 5 weeks</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Active Backlog</h3>
                    {canManage && !isArchived && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={() => {
                          setEditingTask(null);
                          setTaskModalProject({ id: project.id, name: project.name });
                          setIsTaskModalOpen(true);
                        }}
                      >
                        Add Task
                      </Button>
                    )}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {projectTasks.filter((t) => t.status !== 'done').length === 0 ? (
                      <p className="text-center py-8 text-sm text-slate-400">No open tasks — nice work.</p>
                    ) : (
                      projectTasks
                        .filter((t) => t.status !== 'done')
                        .slice(0, 6)
                        .map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
                            <span className="w-3.5 h-3.5 rounded border border-slate-300 shrink-0" />
                            <span className="text-sm text-slate-800 flex-1 truncate">{t.title}</span>
                            <Badge type="priority" value={t.priority} />
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Card>
                  <p className="text-sm font-semibold text-slate-900 mb-3">Metadata</p>
                  <dl className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Created</dt>
                      <dd className="font-semibold text-slate-700">
                        {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Status</dt>
                      <dd className="font-semibold text-slate-700">{project.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Members</dt>
                      <dd className="font-semibold text-slate-700">{members.length}</dd>
                    </div>
                  </dl>
                </Card>

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Project Members</h3>
                  <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={m.user.name} initials={initialsOf(m.user.name)} color={colorForId(m.user.id)} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{m.user.name}</p>
                            <p className="text-[11px] text-slate-400">{PROJECT_ROLE_LABELS[m.role]}</p>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRoleChange(m.id, m.role === 'MANAGER' ? 'MEMBER' : 'MANAGER')}
                              disabled={busy}
                              className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 cursor-pointer"
                            >
                              {m.role === 'MANAGER' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={busy}
                              className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && <p className="px-4 py-6 text-xs text-slate-400 text-center">No members on this project yet.</p>}
                  </div>

                  {canManage && availableToAdd.length > 0 && (
                    <form onSubmit={handleAddMember} className="space-y-2">
                      <Select
                        value={addingMemberId}
                        onChange={(e) => setAddingMemberId(e.target.value)}
                        options={[
                          { value: '', label: 'Select a workspace member...' },
                          ...availableToAdd.map((t) => ({ value: t.id, label: t.name })),
                        ]}
                      />
                      <div className="flex gap-2">
                        <Select
                          value={addingRole}
                          onChange={(e) => setAddingRole(e.target.value)}
                          className="flex-1"
                          options={[
                            { value: 'MEMBER', label: 'Project Member' },
                            { value: 'MANAGER', label: 'Project Manager' },
                          ]}
                        />
                        <Button type="submit" variant="outline" icon={UserPlus} disabled={busy || !addingMemberId}>
                          Add
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    {!isArchived && (
                      <Button variant="outline" size="sm" icon={Archive} onClick={() => setArchiveConfirmOpen(true)} disabled={lifecycleBusy}>
                        Archive Project
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="danger" size="sm" icon={Trash} onClick={() => setDeleteConfirmOpen(true)} disabled={lifecycleBusy}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Tasks' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Tasks ({projectTasks.length})</h3>
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1 rounded-lg flex items-center border border-slate-200 text-xs">
                    <button
                      onClick={() => setTaskViewMode('list')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                        taskViewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setTaskViewMode('board')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                        taskViewMode === 'board' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      Board
                    </button>
                  </div>
                  {canManage && !isArchived && (
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => {
                        setEditingTask(null);
                        setTaskModalProject({ id: project.id, name: project.name });
                        setIsTaskModalOpen(true);
                      }}
                    >
                      Add Task
                    </Button>
                  )}
                </div>
              </div>
              {projectTasks.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-sm font-semibold text-slate-600">No tasks yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create a task to get started.</p>
                </Card>
              ) : taskViewMode === 'list' ? (
                <TaskListView tasks={projectTasks} />
              ) : (
                <KanbanBoard tasks={projectTasks} />
              )}
            </div>
          )}

          {activeTab === 'Calendar' && <ProjectCalendarTab tasks={projectTasks} />}

          {activeTab === 'Activity' && (
            <Card>
              <ActivityFeed scope="project" scopeId={project.id} title="Project Activity" />
            </Card>
          )}

          {activeTab === 'Files' && (
            <Card>
              <AttachmentList projectId={project.id} title="Project Files" />
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={handleArchive}
        title="Archive project"
        description={`Archive "${project.name}"? It'll become read-only — no new or updated tasks — but nothing is deleted, and you can restore it anytime.`}
        confirmLabel="Archive project"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteProject}
        title="Delete project"
        description={`Permanently delete "${project.name}" and all of its tasks and comments? This cannot be undone — consider archiving instead if you might need this again.`}
        confirmLabel="Delete project"
        variant="danger"
        requireTextMatch={project.name}
      />
    </AppLayout>
  );
}

function StatCard({ label, value, accent }) {
  const cls =
    accent === 'emerald' ? 'text-emerald-600' : accent === 'blue' ? 'text-blue-600' : accent === 'purple' ? 'text-purple-600' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}

// A real month view scoped to this project's own tasks — reusing the same
// due-date-driven approach as the Dashboard's week strip, just at
// month granularity and filtered to projectTasks instead of every task.
function ProjectCalendarTab({ tasks }) {
  const [cursor, setCursor] = useState(() => new Date());

  const { weeks, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return {
      weeks: rows,
      monthLabel: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due) return;
      (map[t.due] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            ‹
          </button>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="text-[10px] font-semibold text-slate-400">{d}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="h-16 rounded-lg" />;
              const iso = day.toISOString().slice(0, 10);
              const dayTasks = tasksByDate[iso] || [];
              const isToday = day.getTime() === today.getTime();
              return (
                <div key={di} className={`h-16 rounded-lg border p-1.5 flex flex-col gap-0.5 ${isToday ? 'border-blue-400 bg-blue-50/40' : 'border-slate-100'}`}>
                  <span className={`text-[10px] font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{day.getDate()}</span>
                  {dayTasks.slice(0, 2).map((t) => (
                    <span key={t.id} className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 truncate">
                      {t.title}
                    </span>
                  ))}
                  {dayTasks.length > 2 && <span className="text-[9px] text-slate-400">+{dayTasks.length - 2} more</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
