// Tracks an in-progress invitation or join-link flow across an
// authentication detour (login/register). location.state.from is not
// reliable enough on its own — it's lost on a refresh, on directly
// visiting /login in a new tab, and in some browser back/forward cases —
// so we back it with sessionStorage instead. sessionStorage (not
// localStorage) is intentional: this is a short-lived, single-tab flow,
// not something that should persist indefinitely across browser sessions.
//
// Shape stored: { type: 'invitation' | 'join', token: string }
// 'invitation' -> /invitations/:token (personal, email-bound invite)
// 'join'       -> /join/:token (shareable workspace join link)
// These two are deliberately kept distinct end-to-end; never collapse
// one into the other.

const STORAGE_KEY = 'worksync_pending_invitation';

export function setPendingInvitation(type, token) {
  if (!token) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type, token }));
  } catch {
    // Storage unavailable — the location.state fallback still covers the
    // common case, so this is a soft failure, not worth surfacing.
  }
}

export function getPendingInvitation() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || (parsed.type !== 'invitation' && parsed.type !== 'join')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingInvitation() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

// Builds the in-app path for a pending invitation, so callers have one
// place that knows how the two flows map to routes.
export function pendingInvitationPath(pending) {
  if (!pending) return null;
  return pending.type === 'join' ? `/join/${pending.token}` : `/invitations/${pending.token}`;
}
