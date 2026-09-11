import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WorkSyncLogo } from '../components/common/WorkSyncLogo';

export function SimpleAuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="flex justify-center pt-10 pb-6">
        <Link to="/" className="flex items-center gap-2.5">
          <WorkSyncLogo className="h-8 w-auto" textClassName="text-lg font-bold text-slate-900" />
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 mt-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1.5 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
      </main>

      <footer className="flex justify-center py-10">
        <NavLink to="/login" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </NavLink>
      </footer>
    </div>
  );
}
