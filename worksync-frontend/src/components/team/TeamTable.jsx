import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Mail, MoreVertical, UserMinus, Crown } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';
import { useAuth } from '../../context/AuthContext.jsx';
import { workspaceApi } from '../../api/workspace.api.js';
import { WORKSPACE_ROLE_LABELS } from '../../data/uiConfig.js';

const ROLE_BADGE_CLS = {
  OWNER: 'bg-blue-50 text-blue-600',
  ADMIN: 'bg-purple-50 text-purple-600',
  MEMBER: 'bg-slate-100 text-slate-600'
};

export function TeamTable({ query = '' }) {
  const { team, reload } = useWorkSync();
  const { activeWorkspaceId, activeMembership, user, refreshWorkspaces } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);

  const filteredTeam = query.trim()
    ? team.filter(
        (m) =>
          m.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          m.email.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : team;

  // UI-only gating — the backend enforces the real rule (OWNER only for
  // role changes; OWNER/ADMIN for removal). Hiding a control here is a
  // convenience, not the security boundary.
  const canChangeRoles = activeMembership?.role === 'OWNER';
  const canRemove = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';
  const isOwner = activeMembership?.role === 'OWNER';

  const handleRoleChange = async (member, newRole) => {
    setBusyId(member.membershipId);
    setError('');
    try {
      await workspaceApi.updateMemberRole(activeWorkspaceId, member.membershipId, newRole);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not change role');
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  };

  const handleRemove = async (member) => {
    setBusyId(member.membershipId);
    setError('');
    try {
      await workspaceApi.removeMember(activeWorkspaceId, member.membershipId);
      await reload();
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  };

  const handleTransferOwnership = async (member) => {
    await workspaceApi.updateMemberRole(activeWorkspaceId, member.membershipId, 'OWNER');
    // Ownership transfer atomically demotes the acting OWNER to ADMIN
    // server-side, which changes what this table lets the current user do
    // next (e.g. they lose role-change rights) — refresh the workspace
    // list so activeMembership picks that up, not just the member list.
    await Promise.all([refreshWorkspaces?.(), reload()]);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
      {error && <div className="px-6 py-3 bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-3.5">Member</th>
              <th className="px-4 py-3.5">Workspace Role</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Joined</th>
              <th className="px-4 py-3.5 text-right">Contact</th>
              {(canChangeRoles || canRemove) && <th className="px-4 py-3.5 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeam.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-400">
                  No members match "{query}".
                </td>
              </tr>
            ) : (
            filteredTeam.map((member) => {
              const isSelf = member.id === user?.id;
              return (
                <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={member.name} initials={member.initials} color={member.color} size="md" />
                        {/* Presence dot (Phase 10.6) — green while this member has an
                            active connection to this workspace, gray otherwise. */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                            member.online ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title={member.online ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE_CLS[member.role]}`}
                    >
                      {WORKSPACE_ROLE_LABELS[member.role]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${member.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {member.online ? 'Active now' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500">
                    {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <a
                      href={`mailto:${member.email}`}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </a>
                  </td>
                  {(canChangeRoles || canRemove) && (
                    <td className="px-4 py-4 text-right relative">
                      {member.role !== 'OWNER' && !isSelf && (
                        <>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                            disabled={busyId === member.membershipId}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === member.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-4 top-10 z-50 bg-white rounded-lg shadow-xl border border-slate-100 py-1.5 w-52 text-left">
                                {canChangeRoles && member.role !== 'ADMIN' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'ADMIN')}
                                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left"
                                  >
                                    Make Admin
                                  </button>
                                )}
                                {canChangeRoles && member.role !== 'MEMBER' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'MEMBER')}
                                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left"
                                  >
                                    Make Member
                                  </button>
                                )}
                                {isOwner && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setTransferTarget(member);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left flex items-center gap-1.5"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                    Transfer ownership
                                  </button>
                                )}
                                {canRemove && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setRemoveTarget(member);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 text-left flex items-center gap-1.5"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                    Remove from workspace
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => handleRemove(removeTarget)}
        title="Remove member"
        description={
          removeTarget
            ? `Remove ${removeTarget.name} from this workspace? They'll lose access to all its projects and tasks immediately.`
            : ''
        }
        confirmLabel="Remove member"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        onConfirm={() => handleTransferOwnership(transferTarget)}
        title="Transfer ownership"
        description={
          transferTarget
            ? `Make ${transferTarget.name} the workspace owner? You will be demoted to Admin and can no longer change member roles or delete this workspace.`
            : ''
        }
        confirmLabel="Transfer ownership"
        variant="danger"
      />
    </div>
  );
}
