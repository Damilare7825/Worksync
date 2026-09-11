import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input, PasswordInput } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { GoogleSsoButton } from '../components/common/GoogleSsoButton';
import { useAuth } from '../context/AuthContext.jsx';
import { getRememberedAccounts, forgetAccount } from '../utils/rememberedAccounts.js';
import { initialsOf, colorForId } from '../utils/taskMapping.js';
import { X } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, workspaces, switchAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [accounts, setAccounts] = useState(getRememberedAccounts);
  // Which remembered account (if any) the person picked — once chosen, we
  // skip straight to a password field for that specific email, the same
  // way Google/Microsoft's account chooser works. `null` shows the full
  // list; 'new' means "use a different account", i.e. the plain form.
  const [pickedEmail, setPickedEmail] = useState(null);

  const wantsSwitch = new URLSearchParams(location.search).get('switchAccount') === '1';

  const handlePick = (account) => {
    setPickedEmail(account.email);
    setEmail(account.email);
    setError('');
  };

  const handleForget = (e, accountEmail) => {
    e.stopPropagation();
    forgetAccount(accountEmail);
    setAccounts(getRememberedAccounts());
  };

  const goPostAuth = ({ hasWorkspace, pendingInvitationPath: pendingPath }) => {
    // Priority: a pending invitation/join link (tracked reliably via
    // sessionStorage, see utils/pendingInvitation.js) always wins — an
    // invited user must be sent back to accept it, even if they
    // currently have no workspace, rather than to generic onboarding.
    // location.state.from is kept as a secondary fallback for any other
    // protected page that bounced the user here.
    const from = location.state?.from;
    if (pendingPath) {
      navigate(pendingPath, { replace: true });
    } else if (from) {
      navigate(`${from.pathname}${from.search || ''}`, { replace: true });
    } else {
      navigate(hasWorkspace ? '/dashboard' : '/onboarding');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({ email, password });
      goPostAuth(result);
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // GuestRoute deliberately lets an already-authenticated visitor reach
  // this page when there's no pending invitation and no `from` to restore
  // (ambiguous "Sign In" click while a session already exists) — that's
  // resolved here, not by silently redirecting away. `?switchAccount=1`
  // (set by the "sign in with another account" button below, or by the
  // wrong-account screen on an invitation) skips straight past this and
  // shows the real form instead.
  if (isAuthenticated && !wantsSwitch && user) {
    return (
      <AuthLayout title="You're already signed in" subtitle="Sign in to WorkSync">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 mb-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: colorForId(user.id || user.email) }}
          >
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => goPostAuth({ hasWorkspace: workspaces.length > 0, pendingInvitationPath: null })}
          >
            Continue as {user.name}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              // Preserve any pending invitation (already in sessionStorage,
              // untouched by this) — only the auth session is cleared, so
              // the next successful login picks the invitation right back
              // up instead of losing it.
              switchAccount();
              setPickedEmail(null);
              setEmail('');
              setPassword('');
              navigate('/login?switchAccount=1', { replace: true, state: location.state });
            }}
          >
            Sign in with another account
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Account picker: shown first when there are remembered logins on this
  // browser and the person hasn't picked one (or chosen "use another
  // account") yet. No passwords are ever stored — this only remembers who
  // has signed in before, not their credentials.
  if (accounts.length > 0 && pickedEmail === null) {
    return (
      <AuthLayout title="Choose an account" subtitle="Sign in to WorkSync">
        <div className="space-y-1.5">
          {accounts.map((account) => (
            <div
              key={account.email}
              role="button"
              tabIndex={0}
              onClick={() => handlePick(account)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePick(account);
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left group cursor-pointer"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: colorForId(account.id || account.email) }}
              >
                {initialsOf(account.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{account.name}</p>
                <p className="text-xs text-slate-500 truncate">{account.email}</p>
              </div>
              <button
                type="button"
                onClick={(e) => handleForget(e, account.email)}
                title="Remove this account"
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-opacity flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPickedEmail('new')}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0 text-slate-400 text-lg leading-none">
              +
            </div>
            <p className="text-sm font-semibold text-slate-600">Use another account</p>
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 pt-4">
          Don't have an account?{' '}
          <NavLink to="/register" state={location.state} className="font-bold text-blue-600 hover:text-blue-700">
            Create account
          </NavLink>
        </p>
      </AuthLayout>
    );
  }

  const isReturningPick = pickedEmail && pickedEmail !== 'new';

  return (
    <AuthLayout
      title={isReturningPick ? 'Welcome back' : 'Sign In to WorkSync'}
      subtitle={
        isReturningPick
          ? `Enter the password for ${email}`
          : 'Enter your email and password to access your workspace'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

        {!isReturningPick && (
          <Input
            label="Email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        )}

        <PasswordInput
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          autoFocus={isReturningPick}
        />

        <div className="text-right -mt-2">
          <NavLink to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Forgot password?
          </NavLink>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>

        <GoogleSsoButton />

        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPickedEmail(null);
              setPassword('');
              setError('');
            }}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            Back to account list
          </button>
        )}

        <p className="text-center text-xs text-slate-500 pt-2">
          Don't have an account?{' '}
          <NavLink to="/register" state={location.state} className="font-bold text-blue-600 hover:text-blue-700">
            Create account
          </NavLink>
        </p>
      </form>
    </AuthLayout>
  );
}
