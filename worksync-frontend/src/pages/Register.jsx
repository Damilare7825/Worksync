import React, { useState } from 'react';
import { NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input, PasswordInput } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { GoogleSsoButton } from '../components/common/GoogleSsoButton';
import { useAuth } from '../context/AuthContext.jsx';

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wantsSwitch = new URLSearchParams(location.search).get('switchAccount') === '1';

  // Mirrors the backend's actual passwordSchema (auth.validator.js) exactly:
  // 8+ chars, one lowercase, one uppercase, one number. "Special character"
  // isn't enforced server-side, so it's shown as a bonus tip, not a
  // requirement the form blocks on.
  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const meetsRequirements =
    passwordChecks.length && passwordChecks.upper && passwordChecks.lower && passwordChecks.number;

  // Same "already signed in" situation GuestRoute lets through to Login —
  // Register isn't the right place to show that chooser, so just hand off
  // to Login, carrying along whatever state/intent got us here.
  if (isAuthenticated && !wantsSwitch) {
    return <Navigate to="/login" replace state={location.state} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!meetsRequirements) {
      setError('Password does not meet the requirements below');
      return;
    }

    setLoading(true);
    try {
      // Registration only ever creates the User account — no workspace, no
      // role. Normally every new user lands on /onboarding to create or
      // join one — UNLESS they got here from an invitation/join link, in
      // which case we send them straight back to it instead of stranding
      // them on the generic onboarding screen with no memory of why they
      // signed up in the first place.
      const { pendingInvitationPath } = await register({ name, email, password });
      const from = location.state?.from;
      if (pendingInvitationPath) {
        navigate(pendingInvitationPath, { replace: true });
      } else if (from) {
        navigate(`${from.pathname}${from.search || ''}`, { replace: true });
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Your WorkSync Account" subtitle="Get started with your collaborative workspace today">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

        <Input
          label="Full Name"
          placeholder="e.g. Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />

        <Input
          label="Work Email"
          type="email"
          placeholder="jane@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters, with upper/lowercase and a number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Password requirements
              </p>
              {[
                { key: 'length', label: '8+ characters' },
                { key: 'upper', label: 'At least one uppercase letter' },
                { key: 'lower', label: 'At least one lowercase letter' },
                { key: 'number', label: 'At least one number' },
                { key: 'special', label: 'At least one special character (recommended)' },
              ].map((req) => (
                <div key={req.key} className="flex items-center gap-2">
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[9px] shrink-0 ${
                      passwordChecks[req.key] ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    {passwordChecks[req.key] ? '✓' : ''}
                  </span>
                  <span className={`text-xs ${passwordChecks[req.key] ? 'text-slate-700' : 'text-slate-400'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <PasswordInput
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Creating Account...' : 'Get Started'}
        </Button>

        <GoogleSsoButton />

        <p className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{' '}
          <NavLink to="/login" state={location.state} className="font-bold text-blue-600 hover:text-blue-700">
            Sign in
          </NavLink>
        </p>
      </form>
    </AuthLayout>
  );
}
