// Remembers *who* has logged in on this browser before — name, email,
// user id — purely so the login screen can offer a "continue as..." quick
// pick, the way a real auth system (Google, Microsoft, etc.) does.
//
// Deliberately, this NEVER stores a password or any credential. Storing a
// real password in localStorage/sessionStorage would mean anything with
// script access to the page (including a future XSS bug) could read it
// straight out — this is why browsers' own password managers keep saved
// passwords in encrypted, OS-level storage instead of page-accessible
// storage. "Remember me" here means "remember who", not "remember the
// password"; the actual password still has to be typed (or filled by the
// browser's own password manager, which this doesn't interfere with).

const STORAGE_KEY = 'worksync_remembered_accounts';
const MAX_ACCOUNTS = 5;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(accounts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage full/disabled — remembering accounts is a convenience, not
    // something worth surfacing an error for.
  }
}

export function getRememberedAccounts() {
  return readAll();
}

/**
 * Called after a successful login — moves this account to the front (most
 * recently used first) and caps the list so it doesn't grow forever on a
 * shared machine.
 */
export function rememberAccount({ id, name, email }) {
  if (!email) return;
  const existing = readAll().filter((a) => a.email !== email);
  const updated = [{ id, name, email, lastUsedAt: new Date().toISOString() }, ...existing].slice(
    0,
    MAX_ACCOUNTS
  );
  writeAll(updated);
}

export function forgetAccount(email) {
  writeAll(readAll().filter((a) => a.email !== email));
}
