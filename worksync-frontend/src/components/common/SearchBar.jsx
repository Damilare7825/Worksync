import React from 'react';
import { Search } from 'lucide-react';

export function SearchBar({ value, onChange, placeholder = 'Search tasks, projects...', className = '' }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
      />
    </div>
  );
}
