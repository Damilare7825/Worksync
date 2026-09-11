import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, Send, X, Check, CornerDownRight, CheckCircle2, RotateCcw, SmilePlus } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { commentApi } from '../../api/comment.api.js';
import { projectApi } from '../../api/project.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSocket } from '../../sockets/socket.js';
import { initialsOf, colorForId } from '../../utils/taskMapping.js';
import { MentionInput } from './MentionInput.jsx';
import { AttachmentList } from '../attachments/AttachmentList.jsx';


const REACTION_CHOICES = ['👍', '❤️', '🎉', '👀', '🚀', '😄', '😕'];

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ReactionBar({ comment, currentUserId, onToggle }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const grouped = new Map();
  for (const r of comment.reactions || []) {
    if (!grouped.has(r.emoji)) grouped.set(r.emoji, []);
    grouped.get(r.emoji).push(r.userId);
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap relative">
      {[...grouped.entries()].map(([emoji, userIds]) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
            userIds.includes(currentUserId)
              ? 'bg-blue-50 border-blue-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          {emoji} {userIds.length}
        </button>
      ))}
      <button
        onClick={() => setPickerOpen((v) => !v)}
        className="text-slate-300 hover:text-slate-500 p-0.5"
        title="Add reaction"
      >
        <SmilePlus className="w-3.5 h-3.5" />
      </button>
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg px-1.5 py-1 flex gap-1">
            {REACTION_CHOICES.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="text-sm hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CommentBody({ comment, isReply, currentUserId, onEdit, onDelete, onResolveToggle, onReact, members }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editMentionIds, setEditMentionIds] = useState((comment.mentions || []).map((m) => m.userId));
  const isOwn = comment.userId === currentUserId;

  const save = async () => {
    if (!editContent.trim()) return;
    await onEdit(comment.id, editContent.trim(), editMentionIds);
    setEditing(false);
  };

  return (
    <div className="flex gap-2.5 group">
      <Avatar name={comment.user?.name} initials={initialsOf(comment.user?.name)} color={colorForId(comment.userId)} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-900">{comment.user?.name || 'Unknown'}</span>
          <span className="text-[11px] text-slate-400">{timeAgo(comment.createdAt)}</span>
          {comment.updatedAt !== comment.createdAt && <span className="text-[11px] text-slate-300">(edited)</span>}
          {!isReply && comment.resolved && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
            </span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
            {!isReply && (
              <button
                onClick={onResolveToggle}
                className="p-0.5 rounded text-slate-400 hover:text-emerald-600"
                title={comment.resolved ? 'Reopen discussion' : 'Resolve discussion'}
              >
                {comment.resolved ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              </button>
            )}
            {isOwn && !editing && (
              <>
                <button onClick={() => setEditing(true)} className="p-0.5 rounded text-slate-400 hover:text-blue-600" title="Edit">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => onDelete(comment.id)} className="p-0.5 rounded text-slate-400 hover:text-rose-600" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <div className="mt-1 flex items-start gap-1.5">
            <MentionInput
              value={editContent}
              onChange={setEditContent}
              mentionedIds={editMentionIds}
              onMentionedIdsChange={setEditMentionIds}
              members={members}
              rows={2}
              onSubmitShortcut={save}
            />
            <div className="flex flex-col gap-1 pt-0.5">
              <button onClick={save} className="p-1 rounded text-emerald-600 hover:bg-emerald-50" title="Save">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditContent(comment.content);
                }}
                className="p-1 rounded text-slate-400 hover:bg-slate-100"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
        )}
        <ReactionBar comment={comment} currentUserId={currentUserId} onToggle={(emoji) => onReact(comment, emoji)} />
        <div className="mt-2">
          <AttachmentList commentId={comment.id} title="" compact />
        </div>
      </div>
    </div>

  );
}

/**
 * Discussion thread for a single task: root comments ("discussions") each
 * with reactions, resolve/reopen, and a flat list of replies underneath.
 * Lives inside TaskModal, shown once a task exists.
 */
export function CommentSection({ taskId, projectId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newMentionIds, setNewMentionIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyMentionIds, setReplyMentionIds] = useState([]);
  const [members, setMembers] = useState([]);
  const listEndRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    projectApi.listMembers(projectId).then((res) => setMembers(res.data.members.map((m) => m.user)));
  }, [projectId]);

  const reload = () => commentApi.list(taskId).then((res) => setComments(res.data.comments));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    commentApi
      .list(taskId)
      .then((res) => {
        if (!cancelled) setComments(res.data.comments);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load comments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Real-time: reload on any comment event for this task rather than
  // hand-patching the nested root/reply/reaction tree client-side — the
  // shape is nested enough (root -> replies -> reactions/mentions) that a
  // full refetch is simpler and cheap enough for a per-task comment list.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload) => {
      if (payload?.taskId !== taskId) return;
      reload();
    };
    socket.on('comment.created', handler);
    socket.on('comment.updated', handler);
    socket.on('comment.deleted', handler);
    socket.on('comment.reaction.changed', handler);
    return () => {
      socket.off('comment.created', handler);
      socket.off('comment.updated', handler);
      socket.off('comment.deleted', handler);
      socket.off('comment.reaction.changed', handler);
    };
  }, [taskId, reload]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [comments.length]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const content = newContent.trim();
    if (!content) return;
    setSubmitting(true);
    setError('');
    try {
      await commentApi.create(taskId, { content, mentionedUserIds: newMentionIds });
      setNewContent('');
      setNewMentionIds([]);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (rootId) => {
    const content = replyContent.trim();
    if (!content) return;
    try {
      await commentApi.create(taskId, { content, parentCommentId: rootId, mentionedUserIds: replyMentionIds });
      setReplyingTo(null);
      setReplyContent('');
      setReplyMentionIds([]);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not add reply');
    }
  };

  const handleEdit = async (commentId, content, mentionedUserIds) => {
    try {
      await commentApi.update(commentId, { content, mentionedUserIds });
      await reload();
    } catch (err) {
      setError(err.message || 'Could not update comment');
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await commentApi.remove(commentId);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not delete comment');
    }
  };

  const handleResolveToggle = async (comment) => {
    try {
      if (comment.resolved) await commentApi.reopen(comment.id);
      else await commentApi.resolve(comment.id);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not update discussion status');
    }
  };

  const handleReact = async (comment, emoji) => {
    const alreadyReacted = (comment.reactions || []).some((r) => r.userId === user?.id && r.emoji === emoji);
    try {
      if (alreadyReacted) await commentApi.removeReaction(comment.id, emoji);
      else await commentApi.addReaction(comment.id, emoji);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not react');
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-slate-100">
      <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wider">
        Discussion {comments.length > 0 && <span className="text-slate-400">({comments.length})</span>}
      </h4>

      {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {loading && <p className="text-xs text-slate-400">Loading discussion...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-slate-400">No discussion yet — start one below.</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className={comment.resolved ? 'opacity-70' : ''}>
            <CommentBody
              comment={comment}
              isReply={false}
              currentUserId={user?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onResolveToggle={() => handleResolveToggle(comment)}
              onReact={handleReact}
              members={members}
            />
            <div className="ml-8 mt-2 space-y-2">
              {(comment.replies || []).map((reply) => (
                <CommentBody
                  key={reply.id}
                  comment={reply}
                  isReply
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReact={handleReact}
                  members={members}
                />
              ))}
              {replyingTo === comment.id ? (
                <div className="flex items-start gap-1.5">
                  <MentionInput
                    value={replyContent}
                    onChange={setReplyContent}
                    mentionedIds={replyMentionIds}
                    onMentionedIdsChange={setReplyMentionIds}
                    members={members}
                    placeholder="Write a reply..."
                    rows={2}
                    onSubmitShortcut={() => submitReply(comment.id)}
                  />
                  <button
                    onClick={() => submitReply(comment.id)}
                    disabled={!replyContent.trim()}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setReplyingTo(comment.id);
                    setReplyContent('');
                    setReplyMentionIds([]);
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-blue-600"
                >
                  <CornerDownRight className="w-3 h-3" /> Reply
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-start gap-2 pt-1">
        <MentionInput
          value={newContent}
          onChange={setNewContent}
          mentionedIds={newMentionIds}
          onMentionedIdsChange={setNewMentionIds}
          members={members}
          placeholder="Start a discussion... use @ to mention someone"
          rows={2}
          onSubmitShortcut={handleSubmit}
        />
        <button
          type="submit"
          disabled={submitting || !newContent.trim()}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
