import React, { useState } from 'react';
import { Check, RotateCw, X } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';
import { useAuth } from '../../context/AuthContext.jsx';
import { WORKSPACE_ROLE_LABELS } from '../../data/uiConfig.js';

export function PendingInvitationsTable() {
  const { pendingInvitations, resendInvitation, cancelInvitation } = useWorkSync();
  const { activeMembership } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState('');

  // Same privilege as inviting in the first place — OWNER/ADMIN only. The
  // backend enforces this regardless; hiding the section here just avoids
  // showing a 403-prone action to someone who can't use it.
  const canManage = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';
  if (!canManage) return null;
  if (!pendingInvitations.length) return null;

  const handleResend = async (invitation) => {
    setBusyId(invitation.id);
    setError('');
    try {
      const url = await resendInvitation(invitation.id);
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
        setCopiedId(invitation.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (err) {
      setError(err.message || 'Could not resend invitation');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (invitation) => {
    setBusyId(invitation.id);
    setError('');
    try {
      await cancelInvitation(invitation.id);
    } catch (err) {
      setError(err.message || 'Could not cancel invitation');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
      <div className="px-6 py-3.5 border-b border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pending Invitations ({pendingInvitations.length})
        </p>
      </div>
      {error && <div className="px-6 py-3 bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
      <div className="divide-y divide-slate-100">
        {pendingInvitations.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between px-6 py-3.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">{inv.email}</p>
              <p className="text-xs text-slate-400">
                {WORKSPACE_ROLE_LABELS[inv.role] || inv.role} · Pending
                {inv.expiresAt ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResend(inv)}
                disabled={busyId === inv.id}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                title="Resend and copy a fresh link"
              >
                {copiedId === inv.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Link copied
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" /> Resend
                  </>
                )}
              </button>
              <button
                onClick={() => handleCancel(inv)}
                disabled={busyId === inv.id}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
