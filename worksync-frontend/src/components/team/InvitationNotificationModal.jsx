import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { invitationApi } from '../../api/invitation.api.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Opened from the notification bell when the user clicks an INVITATION
 * notification. Loads the invitation by ID (never a raw token — that is
 * never stored) and lets them accept it right there, without having to
 * dig up the original email/link.
 */
export function InvitationNotificationModal({ invitationId, onClose }) {
  const { switchWorkspace, refreshWorkspaces } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!invitationId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    invitationApi
      .getById(invitationId)
      .then((res) => {
        if (!cancelled) setInvitation(res.data.invitation);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'This invitation could not be found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invitationId]);

  const handleAccept = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      const res = await invitationApi.acceptById(invitationId);
      await refreshWorkspaces();
      switchWorkspace(res.data.workspace.id);
      setDone(true);
    } catch (err) {
      setActionError(err.message || 'Could not accept this invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={Boolean(invitationId)} onClose={onClose} title="Workspace Invitation" maxWidth="max-w-md">
      {loading && (
        <div className="h-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && loadError && (
        <p className="text-sm text-slate-600 text-center py-2">{loadError}</p>
      )}

      {!loading && !loadError && invitation && (
        <>
          {done ? (
            <div className="space-y-4 text-center py-2">
              <p className="text-sm text-slate-600">
                You've joined <strong>{invitation.workspace.name}</strong>.
              </p>
              <Button variant="primary" className="w-full" onClick={onClose}>
                Go to workspace
              </Button>
            </div>
          ) : invitation.status === 'EXPIRED' ? (
            <p className="text-sm text-slate-600 text-center py-2">
              This invitation to join <strong>{invitation.workspace.name}</strong> has expired. Ask
              whoever invited you to send a new one.
            </p>
          ) : invitation.status === 'ACCEPTED' ? (
            <p className="text-sm text-slate-600 text-center py-2">This invitation has already been accepted.</p>
          ) : invitation.status === 'DECLINED' ? (
            <p className="text-sm text-slate-600 text-center py-2">This invitation was already declined.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                You've been invited to join <strong>{invitation.workspace.name}</strong> as{' '}
                {invitation.role.toLowerCase()}.
              </p>
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{actionError}</div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                  Not now
                </Button>
                <Button variant="primary" className="flex-1" onClick={handleAccept} disabled={submitting}>
                  {submitting ? 'Joining...' : 'Accept'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
