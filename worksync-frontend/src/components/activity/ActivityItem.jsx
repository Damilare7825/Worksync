import React from 'react';
import { Avatar } from '../common/Avatar';
import { colorForId, initialsOf } from '../../utils/taskMapping.js';
import { timeAgo } from '../../utils/timeAgo.js';
import { activityDisplay, activityDetail, activityIsAudit } from './activityDisplay.js';

export function ActivityItem({ entry }) {
  const { label, icon: Icon } = activityDisplay(entry.action);
  const detail = activityDetail(entry);
  const actorName = entry.user?.name || 'Someone';

  return (
    <div className="flex gap-2.5">
      <Avatar
        name={actorName}
        initials={initialsOf(actorName)}
        color={colorForId(entry.userId)}
        size="sm"
      />
      <div className="flex-1 min-w-0 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-slate-700 leading-snug">
            <span className="font-semibold text-slate-900">{actorName}</span> {label}
            {detail && <span className="text-slate-500"> — {detail}</span>}
          </p>
          <Icon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400">{timeAgo(entry.createdAt)}</span>
          {activityIsAudit(entry) && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Audit
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
