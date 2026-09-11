import React from 'react';

export function CardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      <div className="h-3 bg-slate-100 rounded w-2/3" />
      <div className="h-8 bg-slate-100 rounded w-full mt-4" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden animate-pulse p-4 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-slate-100 rounded w-1/6" />
          <div className="h-4 bg-slate-100 rounded w-1/5" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-4">
      <div className="h-8 bg-slate-200 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}
