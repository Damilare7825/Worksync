import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  ShieldCheck,
  MessageSquare,
  Flag,
  CheckCircle2,
  LogIn,
  Link2,
  Mail,
  Building2,
  FolderKanban,
  Activity as ActivityIcon,
} from 'lucide-react';

// One entry per action code the backend can emit (see activity.service.js
// callers). Falls back to a generic icon/label for anything not listed
// here, so a future action doesn't break rendering — it just looks plain
// until this map is updated.
const ACTION_CONFIG = {
  WORKSPACE_CREATED: { label: 'created the workspace', icon: Building2 },
  WORKSPACE_UPDATED: { label: 'updated workspace settings', icon: Pencil },
  WORKSPACE_OWNERSHIP_TRANSFERRED: { label: 'transferred workspace ownership', icon: ShieldCheck },
  WORKSPACE_MEMBER_ROLE_CHANGED: { label: 'changed a member\u2019s role', icon: ShieldCheck },
  WORKSPACE_MEMBER_REMOVED: { label: 'removed a member', icon: UserMinus },
  WORKSPACE_INVITE_LINK_ENABLED: { label: 'enabled the invite link', icon: Link2 },
  WORKSPACE_INVITE_LINK_DISABLED: { label: 'disabled the invite link', icon: Link2 },
  WORKSPACE_INVITE_LINK_REGENERATED: { label: 'regenerated the invite link', icon: Link2 },
  USER_JOINED_WORKSPACE: { label: 'joined the workspace', icon: LogIn },
  USER_INVITED: { label: 'invited someone to the workspace', icon: Mail },
  INVITATION_CANCELED: { label: 'canceled an invitation', icon: Mail },
  INVITATION_RESENT: { label: 'resent an invitation', icon: Mail },
  INVITATION_DECLINED: { label: 'declined an invitation', icon: Mail },

  PROJECT_CREATED: { label: 'created the project', icon: FolderKanban },
  PROJECT_UPDATED: { label: 'updated the project', icon: Pencil },
  PROJECT_MEMBER_ADDED: { label: 'added a project member', icon: UserPlus },
  PROJECT_MEMBER_ROLE_CHANGED: { label: 'changed a project member\u2019s role', icon: ShieldCheck },
  PROJECT_MEMBER_REMOVED: { label: 'removed a project member', icon: UserMinus },

  TASK_CREATED: { label: 'created a task', icon: Plus },
  TASK_UPDATED: { label: 'updated a task', icon: Pencil },
  TASK_STATUS_CHANGED: { label: 'changed a task\u2019s status', icon: ArrowRightLeft },
  TASK_PRIORITY_CHANGED: { label: 'changed a task\u2019s priority', icon: Flag },
  TASK_ASSIGNED: { label: 'assigned a task', icon: UserPlus },
  TASK_DELETED: { label: 'deleted a task', icon: Trash2 },
  SUBTASK_CREATED: { label: 'added a subtask', icon: Plus },
  CHECKLIST_ITEM_ADDED: { label: 'added a checklist item', icon: CheckCircle2 },
  CHECKLIST_ITEM_COMPLETED: { label: 'checked off a checklist item', icon: CheckCircle2 },
  CHECKLIST_ITEM_REOPENED: { label: 'reopened a checklist item', icon: CheckCircle2 },
  CHECKLIST_ITEM_DELETED: { label: 'removed a checklist item', icon: Trash2 },
  LABEL_ADDED: { label: 'added a label', icon: Flag },
  LABEL_REMOVED: { label: 'removed a label', icon: Flag },
  DEPENDENCY_ADDED: { label: 'added a task dependency', icon: ArrowRightLeft },
  DEPENDENCY_REMOVED: { label: 'removed a task dependency', icon: ArrowRightLeft },
  TASK_RECURRENCE_SET: { label: 'set this task to repeat', icon: ArrowRightLeft },
  TASK_RECURRENCE_REMOVED: { label: 'stopped this task repeating', icon: ArrowRightLeft },

  COMMENT_ADDED: { label: 'commented', icon: MessageSquare },
  COMMENT_REPLIED: { label: 'replied to a comment', icon: MessageSquare },
  COMMENT_EDITED: { label: 'edited a comment', icon: Pencil },
  COMMENT_DELETED: { label: 'deleted a comment', icon: Trash2 },
  DISCUSSION_RESOLVED: { label: 'resolved a discussion', icon: CheckCircle2 },
  DISCUSSION_REOPENED: { label: 'reopened a discussion', icon: MessageSquare },

  TEAM_CREATED: { label: 'created a team', icon: Plus },
  TEAM_UPDATED: { label: 'updated a team', icon: Pencil },
  TEAM_DELETED: { label: 'deleted a team', icon: Trash2 },
};

export function activityDisplay(action) {
  return ACTION_CONFIG[action] || { label: action?.replaceAll('_', ' ').toLowerCase() || 'did something', icon: ActivityIcon };
}

export function activityIsAudit(entry) {
  return Boolean(entry?.isAudit);
}

// Compact "what happened" summary built from an entry's own metadata,
// shown under the actor line. Deliberately best-effort/optional — most
// metadata shapes are only meaningful with more context than a feed row
// has room for, so this only surfaces the couple of common shapes it can
// render safely without guessing.
export function activityDetail(entry) {
  const { action, metadata } = entry;
  if (!metadata) return null;
  if (action === 'TASK_STATUS_CHANGED' && metadata.from && metadata.to) {
    return `${metadata.from} \u2192 ${metadata.to}`;
  }
  if (action === 'TASK_PRIORITY_CHANGED' && metadata.from && metadata.to) {
    return `${metadata.from} \u2192 ${metadata.to}`;
  }
  if (entry.entityLabel) {
    return entry.entityLabel;
  }
  if (metadata.title) return metadata.title;
  if (metadata.name) return metadata.name;
  return null;
}

export const CheckCircleIcon = CheckCircle2;
