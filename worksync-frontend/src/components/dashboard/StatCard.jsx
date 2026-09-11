import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function StatCard({ label, value, delta, up = true, sub = 'This month' }) {
  return (
    <div className="glass-card glass-card-hover p-5 sm:p-6 rounded-2xl relative overflow-hidden group">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
        {label}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-extrabold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
          {value}
        </div>
        {delta && (
          <div
            className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              up ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {delta}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
    </div>
  );
}
