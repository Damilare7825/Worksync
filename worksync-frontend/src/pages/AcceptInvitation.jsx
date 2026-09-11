import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { invitationApi } from '../api/invitation.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { setPendingInvitation, clearPendingInvitation } from '../utils/pendingInvitation.js';

export function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, status, user, switchAccount, switchWorkspace, refreshWorkspaces } = useAuth();

  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    invitationApi
      .getByToken(token)
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
  }, [token]);

  // Remember this invitation as "pending" the moment we land here, so it
  // survives a detour through login/register even if location.state gets
  // dropped (refresh, opening login in a new tab, etc). Cleared again once
  // the invitation is no longer actionable (accepted/expired/declined) or
  // successfully accepted below.
  useEffect(() => {
    if (invitation?.status === 'INVITED') {
      setPendingInvitation('invitation', token);
    } else if (invitation) {
      clearPendingInvitation();
    }
  }, [invitation, token]);

  const handleAccept = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      const res = await invitationApi.accept(token);
      clearPendingInvitation();
      await refreshWorkspaces();
      switchWorkspace(res.data.workspace.id);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err.message || 'Could not accept this invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      await invitationApi.decline(token);
      clearPendingInvitation();
      navigate('/login');
    } catch (err) {
      setActionError(err.message || 'Could not decline this invitation');
    } finally {
      setSubmitting(false);
    }
  };

  // Wait on both the invitation fetch AND auth bootstrap — checking
  // isAuthenticated before AuthContext has resolved its session check
  // would flash the "sign in" prompt at an already-logged-in user.
  if (loading || status === 'loading') {
    return (
      <AuthLayout title="Loading invitation...">
        <div className="h-24 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (loadError || !invitation) {
    return (
      <AuthLayout title="Invitation not found">
        <p className="text-sm text-slate-600 text-center">{loadError || 'This invitation link is invalid.'}</p>
        <div className="pt-4 text-center">
          <NavLink to="/login" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            Back to sign in
          </NavLink>
        </div>
      </AuthLayout>
    );
  }

  if (invitation.status === 'EXPIRED') {
    return (
      <AuthLayout title="Invitation expired">
        <p className="text-sm text-slate-600 text-center">
          This invitation to join <strong>{invitation.workspace.name}</strong> has expired. Ask
          whoever invited you to send a new one.
        </p>
      </AuthLayout>
    );
  }

  if (invitation.status === 'ACCEPTED') {
    return (
      <AuthLayout title="Already accepted">
        <p className="text-sm text-slate-600 text-center">This invitation has already been accepted.</p>
        <div className="pt-4 text-center">
          <NavLink to="/login" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            Sign in
          </NavLink>
        </div>
      </AuthLayout>
    );
  }

  if (invitation.status === 'DECLINED') {
    return (
      <AuthLayout title="Invitation declined">
        <p className="text-sm text-slate-600 text-center">This invitation was already declined.</p>
      </AuthLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthLayout
        title={`You're invited to ${invitation.workspace.name}`}
        subtitle={`Sign in or create an account with ${invitation.email} to accept as ${invitation.role.toLowerCase()}`}
      >
        <div className="flex flex-col gap-2">
          {/* Passing `from` here is the whole fix: without it, Login/Register
              have no idea an invitation was in progress and just send the
              user to their normal default landing page, silently dropping
              the invitation entirely. */}
          <NavLink to="/login" state={{ from: location }}>
            <Button variant="primary" className="w-full">
              Sign In
            </Button>
          </NavLink>
          <NavLink to="/register" state={{ from: location }}>
            <Button variant="outline" className="w-full">
              Create Account
            </Button>
          </NavLink>
        </div>
      </AuthLayout>
    );
  }

  const handleSwitchAccount = () => {
    // The pending invitation is already tracked in sessionStorage (the
    // effect above), so it's untouched by clearing the session — only the
    // wrong account's auth state goes away. ?switchAccount=1 tells
    // GuestRoute/Login to show the real form immediately instead of the
    // "already signed in" chooser, since intent here is unambiguous.
    switchAccount();
    navigate('/login?switchAccount=1', { replace: true });
  };

  const handleCancel = () => {
    clearPendingInvitation();
    navigate('/dashboard');
  };

  if (user?.email !== invitation.email) {
    return (
      <AuthLayout title="Wrong account">
        <p className="text-sm text-slate-600 text-center">
          This invitation was sent to <strong>{invitation.email}</strong>, but you're signed in as{' '}
          <strong>{user?.email}</strong>.
        </p>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSwitchAccount}>
            Switch Account
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${invitation.workspace.name}`}
      subtitle={`You've been invited as ${invitation.role.toLowerCase()}`}
    >
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium mb-4">{actionError}</div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleDecline} disabled={submitting}>
          Decline
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleAccept} disabled={submitting}>
          {submitting ? 'Joining...' : 'Accept'}
        </Button>
      </div>
    </AuthLayout>
  );
}
