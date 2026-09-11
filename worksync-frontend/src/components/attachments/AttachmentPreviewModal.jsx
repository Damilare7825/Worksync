import React, { useEffect, useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { attachmentApi } from '../../api/attachment.api.js';

export function AttachmentPreviewModal({ attachment, onClose }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attachment) return;
    let url = '';
    let isMounted = true;

    async function loadPreview() {
      setLoading(true);
      setError('');
      try {
        const { blob, objectUrl: loadedUrl } = await attachmentApi.fetchBlob(attachment.id, true);
        if (!isMounted) return;
        url = loadedUrl;
        setObjectUrl(loadedUrl);

        if (attachment.mimeType?.includes('text') || attachment.mimeType?.includes('json')) {
          const text = await blob.text();
          if (isMounted) setTextContent(text.slice(0, 50000));
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load preview');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  if (!attachment) return null;

  const isImage = attachment.mimeType?.startsWith('image/');
  const isPdf = attachment.mimeType?.includes('pdf');
  const isText = attachment.mimeType?.includes('text') || attachment.mimeType?.includes('json');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-bold text-slate-900 truncate">{attachment.originalName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{attachment.mimeType}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="text-center p-4 text-rose-600 text-sm font-medium">{error}</div>
          ) : isImage ? (
            <img
              src={objectUrl}
              alt={attachment.originalName}
              className="max-h-[60vh] object-contain rounded-lg shadow-xs"
            />
          ) : isPdf ? (
            <iframe
              src={objectUrl}
              title={attachment.originalName}
              className="w-full h-[60vh] rounded-lg border border-slate-200"
            />
          ) : isText ? (
            <pre className="w-full h-[50vh] p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-auto leading-relaxed">
              {textContent}
            </pre>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Preview not available for this file type</p>
              <p className="text-xs text-slate-400 mt-1">Download the file to view its content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
