import React from 'react';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../data/uiConfig';

export function Badge({ type, value, className = '' }) {
  if (type === 'priority') {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.low;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.cls} ${className}`}
      >
        {config.label}
      </span>
    );
  }

  if (type === 'status') {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.todo;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.cls} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 ${className}`}
    >
      {value}
    </span>
  );
}
