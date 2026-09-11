import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { SimpleAuthLayout } from '../layouts/SimpleAuthLayout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { authApi } from '../api/auth.api.js';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setSent(true); // Backend always returns the same response whether or not the email exists.
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SimpleAuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a reset link.">
        <NavLink to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          Back to sign in
        </NavLink>
      </SimpleAuthLayout>
    );
  }

  return (
    <SimpleAuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a secure link to restore your WorkSync access."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
        <Input
          label="Email Address"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>
    </SimpleAuthLayout>
  );
}
