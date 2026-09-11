import React, { useState } from 'react';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { WorkspaceOverviewModal } from './WorkspaceOverviewModal.jsx';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const navigate = useNavigate();

  if (!activeWorkspace) return null;

  const handlePick = (id) => {
    if (id !== activeWorkspace.id) {
      switchWorkspace(id);
      // Reload workspace-scoped data cleanly rather than trying to patch
      // state from the old workspace in place.
      navigate('/dashboard');
    }
    setOpen(false);
  };

  return (
    <div className="relative px-3 pb-3">
      <div className="w-full flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
        {/* Clicking the workspace name/role opens a quick overview
            (members + both invite mechanisms) — switching workspaces is a
            separate action via the chevron, so the two don't fight over
            the same click target. */}
        <button
          onClick={() => setOverviewOpen(true)}
          className="flex-1 min-w-0 text-left px-2.5 py-2"
        >
          <p className="text-white text-xs font-bold truncate">{activeWorkspace.name}</p>
          <p className="text-indigo-200/70 text-[10px] uppercase tracking-wide">
            {activeWorkspace.membership.role}
          </p>
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-2 flex-shrink-0"
          title="Switch workspace"
        >
          <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-200/70" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 mt-1 bg-white rounded-lg shadow-xl border border-slate-100 py-1.5 z-50 overflow-hidden">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => handlePick(w.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{w.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{w.membership.role}</p>
                </div>
                {w.id === activeWorkspace.id && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/onboarding');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create workspace
              </button>
            </div>
          </div>
        </>
      )}

      <WorkspaceOverviewModal open={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </div>
  );
}
