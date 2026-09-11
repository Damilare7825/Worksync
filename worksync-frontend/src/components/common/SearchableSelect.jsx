import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * A searchable single-select. Used for the project picker in TaskModal
 * when creating a task globally — with more than a handful of projects a
 * plain <select> is painful to scan, and the spec calls for search here
 * specifically.
 */
export function SearchableSelect({ label, options = [], value, onChange, placeholder = 'Search...', required }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="space-y-1.5 w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
          selected ? 'text-slate-900' : 'text-slate-400'
        } border-slate-200`}
      >
        {selected ? selected.label : 'Select a project...'}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden">
          <div className="relative border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">No projects found</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                    o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
