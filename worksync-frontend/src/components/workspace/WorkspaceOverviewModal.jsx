import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, Mail, RotateCw, Users } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkSync } from '../../context/WorkSyncContext';
import { workspaceApi } from '../../api/workspace.api.js';

export function WorkspaceOverviewModal({ open, onClose }) {
  const { activeWorkspace, activeMembership } = useAuth();
  const { team, setIsInviteModalOpen } = useWorkSync();

  const canManage = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [link, setLink] = useState(null); // { enabled, role, inviteUrl } | null while loading
  const [linkError, setLinkError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !canManage) return;
    setLinkError('');
    workspaceApi
      .getInviteLink(activeWorkspace.id)
      .then((res) => setLink(res.data))
      .catch((err) => setLinkError(err.message || 'Could not load the invite link'));
  }, [open, canManage, activeWorkspace?.id]);

  if (!activeWorkspace) return null;

  const handleCopy = async () => {
    if (!link?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(link.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLinkError('Could not copy — you can select and copy it manually.');
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    setLinkError('');
    try {
      const res = await workspaceApi.enableInviteLink(activeWorkspace.id, 'MEMBER');
      setLink(res.data);
    } catch (err) {
      setLinkError(err.message || 'Could not enable the invite link');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setLinkError('');
    try {
      await workspaceApi.disableInviteLink(activeWorkspace.id);
      setLink((prev) => ({ ...prev, enabled: false, inviteUrl: null }));
    } catch (err) {
      setLinkError(err.message || 'Could not disable the invite link');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    setLinkError('');
    try {
      const res = await workspaceApi.regenerateInviteLink(activeWorkspace.id);
      setLink(res.data);
    } catch (err) {
      setLinkError(err.message || 'Could not regenerate the invite link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={activeWorkspace.name} maxWidth="max-w-lg">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Members ({team.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {team.slice(0, 10).map((m) => (
              <div
                key={m.id}
                title={`${m.name} · ${m.role}`}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-slate-50 border border-slate-100"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                </div>
                <span className="text-xs text-slate-700 truncate max-w-[110px]">{m.name}</span>
              </div>
            ))}
            {team.length > 10 && (
              <span className="text-xs text-slate-400 self-center">+{team.length - 10} more</span>
            )}
          </div>
        </div>

        {canManage && (
          <>
            <div className="pt-1 border-t border-slate-100" />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Invite by email
                </p>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Send a one-time invitation addressed to a specific person's email.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  setIsInviteModalOpen(true);
                }}
              >
                Invite by email
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Shareable invite link
                </p>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Anyone with this link can join as a Member — no email needed. Share it directly, or
                disable it any time.
              </p>

              {linkError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium mb-3">
                  {linkError}
                </div>
              )}

              {!link ? (
                <div className="h-9 flex items-center">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : link.enabled && link.inviteUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      readOnly
                      value={link.inviteUrl}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 bg-transparent text-xs text-slate-700 outline-none min-w-0 truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={busy}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={handleDisable}
                      disabled={busy}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      Disable link
                    </button>
                  </div>
                </div>
              ) : link.enabled && link.hasActiveLink ? (
                // A link exists and is enabled, but the server only ever
                // returns the real, usable URL once — right when it's
                // generated (enable/regenerate). What's stored afterward
                // is a one-way hash it can never turn back into a working
                // link, so on every later visit here we genuinely don't
                // have a URL to show. Regenerating invalidates the old
                // link and hands back a fresh one we CAN display.
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    A shareable link is active, but it's only shown once when created. Generate a
                    new one to get a link you can copy now — the old one will stop working.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleRegenerate} disabled={busy}>
                      {busy ? 'Generating...' : 'Generate new link'}
                    </Button>
                    <button
                      type="button"
                      onClick={handleDisable}
                      disabled={busy}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      Disable link
                    </button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={handleEnable} disabled={busy}>
                  {busy ? 'Enabling...' : 'Create shareable link'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
