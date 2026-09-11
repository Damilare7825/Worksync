import React, { useMemo, useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { useWorkSync } from '../context/WorkSyncContext';
import { Bell, Check, AlertTriangle, MessageSquare, Folder, UserPlus, AtSign, Shield, ListChecks } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { timeAgo } from '../utils/timeAgo.js';

const TYPE_ICON = {
  TASK_ASSIGNED: { icon: ListChecks, cls: 'text-blue-600' },
  MENTION: { icon: AtSign, cls: 'text-purple-600' },
  COMMENT: { icon: MessageSquare, cls: 'text-amber-600' },
  INVITATION: { icon: UserPlus, cls: 'text-blue-600' },
  ROLE_CHANGE: { icon: Shield, cls: 'text-purple-600' },
  DEADLINE_REMINDER: { icon: AlertTriangle, cls: 'text-red-600' },
  PROJECT_UPDATE: { icon: Folder, cls: 'text-blue-600' },
  TASK_UPDATE: { icon: ListChecks, cls: 'text-slate-500' },
  REACTION: { icon: Check, cls: 'text-emerald-600' },
  DISCUSSION_RESOLVED: { icon: Check, cls: 'text-emerald-600' },
};

function getNotifIcon(type) {
  return TYPE_ICON[type] || { icon: Bell, cls: 'text-slate-500' };
}

function groupLabel(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Older';
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
];

export function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useWorkSync();
  const [tab, setTab] = useState('all');

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return n.unread;
    if (tab === 'mentions') return n.type === 'MENTION';
    return true;
  });

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((n) => {
      const label = groupLabel(n.createdAt);
      (groups[label] ||= []).push(n);
    });
    return groups;
  }, [filtered]);

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'].filter((g) => grouped[g]?.length);

  return (
    <AppLayout title="Notifications" subtitle="Manage and track your operational feed alerts">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track your operational feed alerts</p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
                Mark all as read
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t.label}
                {t.id === 'unread' && unreadCount > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${tab === 'unread' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="notification"
              title={tab === 'unread' ? "You're all caught up" : tab === 'mentions' ? 'No mentions yet' : 'No notifications'}
              description={
                tab === 'unread'
                  ? 'No unread notifications right now.'
                  : tab === 'mentions'
                  ? "You'll see it here when someone @mentions you."
                  : "You're all caught up."
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {groupOrder.map((label) => (
                <div key={label} className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">{label}</p>
                  {grouped[label].map((n) => {
                    const { icon: Icon, cls } = getNotifIcon(n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => n.unread && markNotificationRead(n.id)}
                        className={`bg-white rounded-lg p-4 flex gap-3 items-start transition-colors cursor-pointer border ${
                          n.unread ? 'border-blue-400' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Icon className={`w-4 h-4 ${cls}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900">
                            <span className="font-semibold">{n.title}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
