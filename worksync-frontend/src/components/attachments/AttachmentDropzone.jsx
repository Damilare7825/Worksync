import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

const FORBIDDEN_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi', '.dll', '.com', '.scr',
];

export function AttachmentDropzone({ onUpload, isUploading = false, maxSizeBytes = 10 * 1024 * 1024 }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError('');

    const ext = `.${file.name.split('.').pop()}`.toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      setError(`File extension '${ext}' is not allowed for security reasons.`);
      return;
    }

    if (file.size > maxSizeBytes) {
      setError(`File exceeds maximum size limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`);
      return;
    }

    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || 'Failed to upload file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50'
            : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50'
        } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center gap-1.5">
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-slate-400" />
          )}
          <div className="text-xs text-slate-600 font-medium">
            {isUploading ? (
              <span>Uploading attachment...</span>
            ) : (
              <span>
                <strong className="text-indigo-600 font-semibold">Click to upload</strong> or drag and drop files
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Max file size 10MB (Images, PDFs, Documents, Code)</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-2 rounded-md bg-rose-50 text-rose-600 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
