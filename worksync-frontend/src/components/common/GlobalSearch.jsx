import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Folder,
  User,
  MessageSquare,
  Command,
  X,
  Loader2,
  ListPlus,
  FolderPlus,
  UserPlus,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkSync } from '../../context/WorkSyncContext';
import { searchApi } from '../../api/search.api.js';

const TYPE_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'TASKS', label: 'Tasks' },
  { id: 'PROJECTS', label: 'Projects' },
  { id: 'DISCUSSIONS', label: 'Discussions' },
  { id: 'MEMBERS', label: 'Members' },
];

const RECENT_SEARCHES_KEY = 'worksync:recent-searches';
const MAX_RECENT = 5;

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const existing = loadRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadRecentSearches();
  }
}

export function GlobalSearch() {
  const { activeWorkspaceId } = useAuth();
  const { setIsTaskModalOpen, setIsProjectModalOpen, setIsInviteModalOpen } = useWorkSync();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    tasks: [],
    projects: [],
    members: [],
    discussions: [],
    workspaces: [],
  });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());

  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ tasks: [], projects: [], members: [], discussions: [], workspaces: [] });
      setSuggestions([]);
    }
  }, [isOpen]);

  // Debounced search fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !activeWorkspaceId || !isOpen) {
      setResults({ tasks: [], projects: [], members: [], discussions: [], workspaces: [] });
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [searchRes, suggestRes] = await Promise.all([
          searchApi.search(activeWorkspaceId, query.trim(), { type: activeType }),
          searchApi.suggestions(activeWorkspaceId, query.trim()).catch(() => ({ data: { suggestions: [] } })),
        ]);
        setResults(searchRes.data);
        setSuggestions(suggestRes?.data?.suggestions || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, activeType, activeWorkspaceId, isOpen]);

  // Collect flat list of all matching items for arrow key navigation
  const flatItems = [];
  results.tasks?.forEach((t) => flatItems.push({ type: 'TASK', item: t, path: `/projects/${t.projectId}` }));
  results.projects?.forEach((p) => flatItems.push({ type: 'PROJECT', item: p, path: `/projects/${p.id}` }));
  results.discussions?.forEach((d) => flatItems.push({ type: 'DISCUSSION', item: d, path: `/projects/${d.task?.projectId}` }));
  results.members?.forEach((m) => flatItems.push({ type: 'MEMBER', item: m, path: '/team' }));

  const handleKeyDownModal = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        goTo(flatItems[selectedIndex].path);
      }
    }
  };

  const goTo = (path) => {
    if (query.trim()) setRecentSearches(saveRecentSearch(query.trim()));
    setIsOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Trigger Button in Topbar */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl text-xs transition-colors border border-slate-200/60 shadow-2xs"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium pr-4">Search WorkSync...</span>
        <kbd className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500 shadow-2xs">
          <Command className="w-2.5 h-2.5" /> K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            onKeyDown={handleKeyDownModal}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
          >
            {/* Search Input Bar */}
            <div className="relative flex items-center px-4 py-3.5 border-b border-slate-100">
              <Search className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search tasks, projects, people..."
                className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              {loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-2 shrink-0" />}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-50/80 border-b border-slate-100 overflow-x-auto">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveType(tab.id)}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    activeType === tab.id
                      ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Suggestions Bar */}
            {suggestions.length > 0 && (
              <div className="px-4 py-2 bg-blue-50/40 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0">
                  Suggestions:
                </span>
                {suggestions.map((s) => (
                  <button
                    key={`${s.type}-${s.id}`}
                    onClick={() => {
                      if (s.type === 'TASK') goTo(`/projects/${s.targetId}`);
                      else if (s.type === 'PROJECT') goTo(`/projects/${s.targetId}`);
                      else if (s.type === 'MEMBER') goTo('/team');
                    }}
                    className="text-xs font-medium px-2 py-0.5 rounded bg-white text-blue-700 border border-blue-100 hover:bg-blue-50 truncate shrink-0 max-w-[150px]"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {!query.trim() && (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Actions</p>
                    <div className="flex flex-wrap gap-2 px-2 pt-1">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setIsTaskModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <ListPlus className="w-3.5 h-3.5" /> Create Task
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setIsProjectModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> Create Project
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setIsInviteModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Invite Teammate
                      </button>
                      <button
                        onClick={() => goTo('/calendar')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        <CalendarDays className="w-3.5 h-3.5" /> Calendar
                      </button>
                    </div>
                  </div>

                  {recentSearches.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent Searches</p>
                      <div className="flex flex-col">
                        {recentSearches.map((q) => (
                          <button
                            key={q}
                            onClick={() => setQuery(q)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-left cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-600">{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recentSearches.length === 0 && (
                    <div className="text-center py-6 px-4">
                      <p className="text-xs text-slate-400">
                        Find tasks, projects, team members, and discussion threads instantly.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {query.trim() && !loading && flatItems.length === 0 && (
                <div className="text-center py-10 px-4 text-xs text-slate-400">
                  No matching results found for "{query}".
                </div>
              )}

              {/* Tasks */}
              {results.tasks?.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasks</p>
                  <div className="space-y-1">
                    {results.tasks.map((t) => {
                      const itemIdx = flatItems.findIndex((x) => x.type === 'TASK' && x.item.id === t.id);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={t.id}
                          onClick={() => goTo(`/projects/${t.projectId}`)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{t.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{t.project?.name}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider shrink-0 ml-2">
                            {t.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Projects */}
              {results.projects?.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Projects</p>
                  <div className="space-y-1">
                    {results.projects.map((p) => {
                      const itemIdx = flatItems.findIndex((x) => x.type === 'PROJECT' && x.item.id === p.id);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={p.id}
                          onClick={() => goTo(`/projects/${p.id}`)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                              {p.description && <p className="text-[11px] text-slate-400 truncate">{p.description}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase tracking-wider shrink-0 ml-2">
                            {p.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discussions */}
              {results.discussions?.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Discussions</p>
                  <div className="space-y-1">
                    {results.discussions.map((d) => {
                      const itemIdx = flatItems.findIndex((x) => x.type === 'DISCUSSION' && x.item.id === d.id);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={d.id}
                          onClick={() => goTo(`/projects/${d.task?.projectId}`)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <MessageSquare className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{d.content}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                Task: {d.task?.title} • {d.user?.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Members */}
              {results.members?.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Members</p>
                  <div className="space-y-1">
                    {results.members.map((m) => {
                      const itemIdx = flatItems.findIndex((x) => x.type === 'MEMBER' && x.item.id === m.id);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={m.id}
                          onClick={() => goTo('/team')}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <User className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider shrink-0 ml-2">
                            {m.workspaceRole}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Shortcuts */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↵</kbd> select
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">esc</kbd> close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
