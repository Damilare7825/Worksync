import React, { useState } from 'react';

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
          error ? 'border-red-500 focus:ring-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Same as Input, but for password fields: adds a real "Show"/"Hide" toggle
// that flips the native input type, rather than a decorative icon.
export function PasswordInput({ label, error, className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className={`w-full px-3 py-2 pr-14 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
          tabIndex={-1}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Select({ label, options = [], className = '', ...props }) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
