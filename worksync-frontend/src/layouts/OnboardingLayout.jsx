import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { WorkSyncLogo } from '../components/common/WorkSyncLogo';

// Note on step count: the reference design showed "Step X of 6", implying
// steps like inviting teammates or choosing a workspace icon. The real
// onboarding flow this app supports end-to-end is 3 steps (welcome,
// profile, workspace) — so the progress bar reflects that honestly rather
// than showing 6 dots where 3 of them would never complete.
const TOTAL_STEPS = 3;

export function OnboardingLayout({ children, step, onSkip }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <WorkSyncLogo className="h-7 w-auto" textClassName="text-base font-bold text-slate-900" />
        </Link>
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 === step ? 'w-6 bg-blue-600' : i + 1 < step ? 'w-1.5 bg-blue-600' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
          <span className="text-xs text-slate-400 ml-2">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
        {onSkip ? (
          <button type="button" onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600 cursor-pointer">
            Skip onboarding
          </button>
        ) : (
          <span className="w-24" />
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8">{children}</div>
      </main>

      <footer className="px-6 py-6 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-400">
        <span>&copy; {new Date().getFullYear()} WorkSync Technologies Inc.</span>
        <div className="flex items-center gap-4">
          <NavLink to="/" className="hover:text-slate-600">Privacy Policy</NavLink>
          <NavLink to="/" className="hover:text-slate-600">Terms of Service</NavLink>
        </div>
      </footer>
    </div>
  );
}
