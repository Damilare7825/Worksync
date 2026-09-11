import React, { useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { TeamTable } from '../components/team/TeamTable';
import { PendingInvitationsTable } from '../components/team/PendingInvitationsTable';
import { Button } from '../components/common/Button';
import { UserPlus, Search } from 'lucide-react';
import { useWorkSync } from '../context/WorkSyncContext';
import { useAuth } from '../context/AuthContext.jsx';

export function TeamPage() {
  const { setIsInviteModalOpen, team, pendingInvitations } = useWorkSync();
  const { activeMembership } = useAuth();
  const [query, setQuery] = useState('');
  // Invite/remove/manage-members is an OWNER/ADMIN privilege — the button
  // is hidden for plain MEMBERs, but the backend enforces this regardless.
  const canInvite = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  return (
    <AppLayout title="Team Members" subtitle="Manage authorization access and governance controls">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Members</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage authorization access and governance controls</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search members..."
                  className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
              </div>
              {canInvite && (
                <Button variant="primary" icon={UserPlus} onClick={() => setIsInviteModalOpen(true)}>
                  Invite Member
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 mb-1.5">Workspace Population</p>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-slate-900">{team.length} Members</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                {team.length} Active
              </span>
              {pendingInvitations.length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {pendingInvitations.length} Pending
                </span>
              )}
            </div>
          </div>

          <TeamTable query={query} />
          <PendingInvitationsTable />
        </div>
      </div>
    </AppLayout>
  );
}
