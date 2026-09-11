import React from 'react';

export function Card({ children, className = '', onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-100 p-5 shadow-xs ${
        hover ? 'hover:shadow-md hover:border-slate-200 transition-all cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
