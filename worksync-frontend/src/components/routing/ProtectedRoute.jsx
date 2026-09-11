import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getPendingInvitation, pendingInvitationPath } from '../../utils/pendingInvitation.js';

export function ProtectedRoute({ requireWorkspace = true }) {
  const { isAuthenticated, status, activeWorkspaceId, workspaces } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireWorkspace && !activeWorkspaceId) {
    // Same priority as the login/register flows: don't strand a user with
    // a pending invitation on generic onboarding just because they have no
    // workspace yet.
    const pendingPath = pendingInvitationPath(getPendingInvitation());
    if (pendingPath) return <Navigate to={pendingPath} replace />;
    return <Navigate to={workspaces.length === 0 ? '/onboarding' : '/select-workspace'} replace />;
  }

  return <Outlet />;
}

// For /login, /register — an authenticated user landing here has one of
// three distinct intents, and only one of them should silently redirect
// away without ever showing a form:
//
// 1. They have a pending invitation/join link, or got bounced here from
//    another protected page (`from` state) — that's not really "sign in"
//    intent at all, just an auth detour, so send them straight back to
//    where they were headed.
// 2. They explicitly asked to switch accounts (?switchAccount=1, e.g. from
//    the "wrong account" screen on an invitation, or the "sign in with
//    another account" choice below) — always show the real form,
//    regardless of the still-valid old session.
// 3. Otherwise (e.g. clicked the plain "Sign In" link while already
//    logged in) — ambiguous intent. Don't silently bounce them to
//    /dashboard; let Login/Register render an explicit "you're already
//    signed in as X — continue, or sign in as someone else" choice
//    instead. That choice is what actually resolves cases 2 and 3 do
//    not conflict.
export function GuestRoute() {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;

  const wantsSwitch = new URLSearchParams(location.search).get('switchAccount') === '1';

  if (isAuthenticated && !wantsSwitch) {
    const pendingPath = pendingInvitationPath(getPendingInvitation());
    const from = location.state?.from;
    if (pendingPath) return <Navigate to={pendingPath} replace />;
    if (from) return <Navigate to={`${from.pathname}${from.search || ''}`} replace />;
    // Fall through — no forced redirect target, let Login/Register decide.
  }
  return <Outlet />;
}
