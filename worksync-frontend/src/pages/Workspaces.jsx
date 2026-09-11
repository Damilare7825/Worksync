import React from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { useAuth } from '../context/AuthContext.jsx';
import { Globe, ArrowRight } from 'lucide-react';

export function Workspaces() {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useAuth();

  const handleSwitch = (id) => {
    switchWorkspace(id);
  };

  return (
    <AppLayout title="Workspaces" subtitle="Manage and switch between your workspaces">
      <div className="flex flex-col w-full h-full p-8 gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#e5e2e3] tracking-tight">Workspaces</h1>
            <p className="text-sm text-[#cbc3d7] mt-1">Switch between workspaces or create a new one.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            return (
              <button
                key={workspace.id}
                onClick={() => handleSwitch(workspace.id)}
                className={`flex flex-col items-start p-6 rounded-2xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#a078ff]/10 border-[#a078ff]/40 shadow-lg'
                    : 'bg-[#201f20] border-[#353436]/40 hover:border-[#a078ff]/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isActive ? 'bg-[#a078ff]/20 text-[#d0bcff]' : 'bg-[#2a2a2b] text-[#cbc3d7]'
                  }`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#e5e2e3]">{workspace.name}</h3>
                    <p className="text-[10px] text-[#cbc3d7] uppercase tracking-wider font-semibold">
                      {workspace.membership?.role || 'Member'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#d0bcff] font-semibold">
                  {isActive ? 'Current workspace' : 'Switch to this workspace'}
                  {!isActive && <ArrowRight className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
