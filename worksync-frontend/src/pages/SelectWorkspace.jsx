import React from 'react';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export function SelectWorkspace() {
  const { workspaces, switchWorkspace } = useAuth();
  const navigate = useNavigate();

  const pick = (id) => {
    switchWorkspace(id);
    navigate('/dashboard');
  };

  return (
    <AuthLayout title="Choose a workspace" subtitle="Pick which workspace you'd like to open">
      <div className="space-y-2">
        {workspaces.map((w) => (
          <button
            key={w.id}
            onClick={() => pick(w.id)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
          >
            <span className="font-semibold text-slate-900 text-sm">{w.name}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wide">{w.membership.role}</span>
          </button>
        ))}
      </div>
    </AuthLayout>
  );
}
