import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { inviteLinkApi } from '../api/inviteLink.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { setPendingInvitation, clearPendingInvitation } from '../utils/pendingInvitation.js';

export function JoinWorkspace() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, status, switchWorkspace, refreshWorkspaces } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    inviteLinkApi
      .preview(token)
      .then((res) => {
        if (!cancelled) setWorkspace(res.data.workspace);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'This invite link is invalid or no longer active');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Same pending-flow tracking as AcceptInvitation, tagged 'join' so it
  // restores to /join/:token specifically, never /invitations/:token.
  useEffect(() => {
    if (workspace) setPendingInvitation('join', token);
    else if (loadError) clearPendingInvitation();
  }, [workspace, loadError, token]);

  const handleJoin = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      const res = await inviteLinkApi.join(token);
      clearPendingInvitation();
      await refreshWorkspaces();
      switchWorkspace(res.data.workspace.id);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err.message || 'Could not join this workspace');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <AuthLayout title="Loading invite link...">
        <div className="h-24 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (loadError || !workspace) {
    return (
      <AuthLayout title="Invite link not found">
        <p className="text-sm text-slate-600 text-center">
          {loadError || 'This invite link is invalid or has been disabled.'}
        </p>
        <div className="pt-4 text-center">
          <NavLink to="/login" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            Back to sign in
          </NavLink>
        </div>
      </AuthLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthLayout
        title={`You're invited to ${workspace.name}`}
        subtitle={`Sign in or create an account to join as ${workspace.role.toLowerCase()}`}
      >
        <div className="flex flex-col gap-2">
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
        <p className="text-[11px] text-slate-400 text-center pt-3">
          Come back to this link after signing in to join {workspace.name}.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Join ${workspace.name}`} subtitle={`You'll join as ${workspace.role.toLowerCase()}`}>
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium mb-4">{actionError}</div>
      )}
      <Button variant="primary" className="w-full" onClick={handleJoin} disabled={submitting}>
        {submitting ? 'Joining...' : 'Join Workspace'}
      </Button>
    </AuthLayout>
  );
}
