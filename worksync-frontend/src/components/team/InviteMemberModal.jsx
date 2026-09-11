import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { useWorkSync } from '../../context/WorkSyncContext';

export function InviteMemberModal() {
  const { isInviteModalOpen, setIsInviteModalOpen, inviteMember } = useWorkSync();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const close = () => {
    setIsInviteModalOpen(false);
    setEmail('');
    setRole('MEMBER');
    setError('');
    setSent(false);
    setInviteUrl('');
    setCopied(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = await inviteMember({ email, role });
      setInviteUrl(url || '');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the link — you can select and copy it manually.');
    }
  };

  return (
    <Modal isOpen={isInviteModalOpen} onClose={close} title="Invite Team Member" maxWidth="max-w-md">
      {sent ? (
        <div className="space-y-4 py-2">
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Invitation created successfully</p>
            <p className="text-xs text-slate-500 mt-1">
              For <strong>{email}</strong> as {role === 'ADMIN' ? 'an Admin' : 'a Member'}
            </p>
          </div>

          {inviteUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 bg-transparent text-xs text-slate-700 outline-none min-w-0 truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <p className="text-[11px] text-slate-400">
                Share this link directly — it's shown only once and won't be retrievable again.
              </p>
            </div>
          ) : (
            <p className="text-xs text-center text-slate-500">
              An email invitation was sent, but no shareable link was returned.
            </p>
          )}

          <Button variant="primary" onClick={close} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
          <Input
            label="Email Address"
            type="email"
            placeholder="alex@worksync.io"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {/* OWNER is never assignable via invitation — only via ownership
              transfer on an existing member, matching the backend. */}
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'MEMBER', label: 'Member — participates in projects' },
              { value: 'ADMIN', label: 'Admin — manages members & projects' }
            ]}
          />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
