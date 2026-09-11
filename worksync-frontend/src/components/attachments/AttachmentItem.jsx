import React, { useState } from 'react';
import {
  File,
  FileText,
  Image as ImageIcon,
  FileCode,
  Download,
  Eye,
  Trash2,
} from 'lucide-react';
import { attachmentApi } from '../../api/attachment.api.js';

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document'))
    return FileText;
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html'))
    return FileCode;
  return File;
}

export function AttachmentItem({ attachment, onDelete, onPreview, canDelete = true }) {
  const [downloading, setDownloading] = useState(false);
  const Icon = getFileIcon(attachment.mimeType);

  const isPreviewable =
    attachment.mimeType?.startsWith('image/') ||
    attachment.mimeType?.includes('pdf') ||
    attachment.mimeType?.includes('text') ||
    attachment.mimeType?.includes('json');

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const { objectUrl } = await attachmentApi.fetchBlob(attachment.id, false);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = attachment.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 truncate" title={attachment.originalName}>
            {attachment.originalName}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
            <span>{formatBytes(attachment.sizeBytes)}</span>
            {attachment.uploader?.name && <span>• {attachment.uploader.name}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-3">
        {isPreviewable && onPreview && (
          <button
            type="button"
            onClick={() => onPreview(attachment)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-colors"
            title="Preview file"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </button>

        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(attachment.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
