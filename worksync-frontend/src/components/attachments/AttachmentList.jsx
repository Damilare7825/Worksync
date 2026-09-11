import React, { useEffect, useState, useCallback } from 'react';
import { AttachmentItem } from './AttachmentItem.jsx';
import { AttachmentDropzone } from './AttachmentDropzone.jsx';
import { AttachmentPreviewModal } from './AttachmentPreviewModal.jsx';
import { attachmentApi } from '../../api/attachment.api.js';
import { Paperclip, Loader2 } from 'lucide-react';

export function AttachmentList({
  workspaceId,
  projectId,
  taskId,
  commentId,
  canUpload = true,
  canDelete = true,
  title = 'Attachments',
  compact = false,
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewingAttachment, setPreviewingAttachment] = useState(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await attachmentApi.list({ workspaceId, projectId, taskId, commentId });
      setAttachments(res.data.attachments || []);
    } catch (err) {
      setError(err.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, taskId, commentId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUpload = async (file) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (commentId) formData.append('commentId', commentId);
      else if (taskId) formData.append('taskId', taskId);
      else if (projectId) formData.append('projectId', projectId);
      else if (workspaceId) formData.append('workspaceId', workspaceId);

      await attachmentApi.upload(formData);
      await fetchAttachments();
    } catch (err) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await attachmentApi.delete(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete attachment');
    }
  };

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Paperclip className="w-4 h-4 text-indigo-600" />
            <span>
              {title} ({attachments.length})
            </span>
          </div>
        </div>
      )}

      {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}

      {canUpload && (
        <AttachmentDropzone onUpload={handleUpload} isUploading={uploading} />
      )}

      {loading ? (
        <div className="flex justify-center py-4 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-4 px-2 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
          No attachments yet.
        </div>
      ) : (
        <div className={`space-y-2 ${compact ? 'max-h-48 overflow-y-auto pr-1' : ''}`}>
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onDelete={handleDelete}
              onPreview={setPreviewingAttachment}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {previewingAttachment && (
        <AttachmentPreviewModal
          attachment={previewingAttachment}
          onClose={() => setPreviewingAttachment(null)}
        />
      )}
    </div>
  );
}
