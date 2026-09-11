import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Generic confirmation dialog for destructive or hard-to-undo actions
 * (removing a member, transferring ownership, deleting a workspace/
 * project). Callers control open state; `onConfirm` may be async — the
 * dialog shows its own busy state and surfaces the error inline rather
 * than closing on failure, so the person isn't left wondering whether a
 * destructive action actually went through.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger', // 'danger' | 'default'
  requireTextMatch, // optional: e.g. workspace name, must be typed exactly to enable confirm
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');

  const close = () => {
    if (busy) return;
    setError('');
    setTyped('');
    onClose();
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      setTyped('');
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = !requireTextMatch || typed === requireTextMatch;

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="max-w-sm">
      <div className="space-y-4">
        {description && <p className="text-sm text-slate-600">{description}</p>}

        {requireTextMatch && (
          <div>
            <p className="text-xs text-slate-500 mb-1.5">
              Type <span className="font-semibold text-slate-700">{requireTextMatch}</span> to confirm.
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        )}

        {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={busy || !canConfirm}
          >
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
