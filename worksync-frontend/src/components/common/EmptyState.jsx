import React from 'react';
import { FolderPlus, Plus, Inbox, Search, Bell, CheckSquare } from 'lucide-react';

const ICONS = {
  project: FolderPlus,
  task: CheckSquare,
  search: Search,
  notification: Bell,
  default: Inbox,
};

export function EmptyState({
  title = 'No items found',
  description = 'Get started by creating your first item.',
  icon = 'default',
  actionLabel,
  onAction,
}) {
  const IconComponent = ICONS[icon] || ICONS.default;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center my-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-4">
        <IconComponent className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
