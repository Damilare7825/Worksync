import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, NavLink } from 'react-router-dom';
import { SimpleAuthLayout } from '../layouts/SimpleAuthLayout';
import { PasswordInput } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { authApi } from '../api/auth.api.js';

// Same 4 real signals the backend's passwordSchema actually checks
// (auth.validator.js: length, lowercase, uppercase, number) plus special
// character as a bonus signal — this mirrors Register's checklist so
// "strength" here isn't an invented score, it's a count of real
// requirements met.
function scorePassword(password) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length;
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Highly secure password'];

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const score = useMemo(() => scorePassword(password), [password]);
  const meetsRequirements = password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Request a new one from the forgot password page.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!meetsRequirements) {
      setError('Password must be 8+ characters with an uppercase letter, a lowercase letter, and a number');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SimpleAuthLayout title="Password reset" subtitle="Your password has been updated. Redirecting you to sign in...">
        <NavLink to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          Go to sign in now
        </NavLink>
      </SimpleAuthLayout>
    );
  }

  return (
    <SimpleAuthLayout title="Set new password" subtitle="Please create a password you haven't used before.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
        {!token && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
            No reset token found in this link. Open the link from your email again, or{' '}
            <NavLink to="/forgot-password" className="underline font-semibold">
              request a new one
            </NavLink>
            .
          </div>
        )}

        <div>
          <PasswordInput
            label="New Password"
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full ${
                      score > i ? (score <= 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium mt-1 ${score >= 5 ? 'text-emerald-600' : score >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                {STRENGTH_LABELS[Math.max(0, score - 1)]}
              </p>
            </div>
          )}
        </div>

        <PasswordInput
          label="Confirm New Password"
          placeholder="Re-enter the new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>
    </SimpleAuthLayout>
  );
}
