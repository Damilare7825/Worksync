import React from 'react';
import { Link } from 'react-router-dom';
import { WorkSyncLogo } from '../components/common/WorkSyncLogo';

// Real, live data pulled onto the left showcase panel — not decorative
// placeholder cards. Kept intentionally small/static (no API calls) since
// this panel renders before the person has even authenticated.
const SHOWCASE_TASKS = [
  { title: 'Refactor core timeline schedules', who: 'Sarah K.', dot: 'bg-emerald-500' },
  { title: 'Audit authorization token lifecycle', who: 'Dave T.', dot: 'bg-amber-500' },
  { title: 'Benchmark DB queries performance', who: 'Liam F.', dot: 'bg-slate-400' },
];

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left showcase panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#0a0a0a] text-white p-10 xl:p-14">
        <Link to="/" className="flex items-center gap-2.5 w-fit">
          <WorkSyncLogo className="h-8 w-auto" textClassName="text-lg font-bold text-white" />
        </Link>

        <div className="flex flex-col gap-8 max-w-md">
          <div className="bg-white text-slate-900 rounded-xl p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-slate-900" />
              <div>
                <p className="text-sm font-semibold">Release Sprint V2</p>
                <p className="text-xs text-slate-400">WorkSync Workspace</p>
              </div>
              <span className="ml-auto text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                Active Track
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {SHOWCASE_TASKS.map((t) => (
                <div key={t.title} className="flex items-center gap-3 border border-slate-100 rounded-lg px-3 py-2.5">
                  <span className="w-3.5 h-3.5 rounded border border-slate-300 shrink-0" />
                  <span className="text-xs font-medium text-slate-800 flex-1">{t.title}</span>
                  <span className="text-[11px] text-slate-400">{t.who}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Linear-level precision, document-like simplicity.
            </h1>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Join thousands of high-performing engineering and product teams orchestrating complex backlogs and
              sprint cycles inside WorkSync.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} WorkSync Technologies Inc. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        <div className="w-full max-w-sm mx-auto">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 w-fit mb-8">
            <WorkSyncLogo className="h-8 w-auto" textClassName="text-lg font-bold text-slate-900" />
          </Link>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
