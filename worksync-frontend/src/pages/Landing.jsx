import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  FolderOpen,
  MessageCircle,
  Zap,
  Check,
  CheckCircle2,
  FolderKanban,
  ListChecks,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WorkSyncLogo } from '../components/common/WorkSyncLogo';

const STEPS = [
  { n: '01', label: 'Plan', icon: Compass, copy: 'Define timelines, outline scope, and break initiatives down.' },
  { n: '02', label: 'Organize', icon: FolderOpen, copy: 'Group deliverables in dedicated team workspaces.' },
  { n: '03', label: 'Collaborate', icon: MessageCircle, copy: 'Exchange structured real-time updates and comments.' },
  { n: '04', label: 'Execute', icon: Zap, copy: 'Focus with unified, distraction-free priority filters.' },
  { n: '05', label: 'Complete', icon: Check, copy: 'Archive completed work and extract pipeline performance metrics.' },
];

const CAPABILITIES = [
  { label: 'Projects', icon: FolderKanban, copy: 'Organize tasks into isolated, highly focused team workspaces tailored to specific goals.' },
  { label: 'Tasks', icon: ListChecks, copy: 'Track every operational deliverable with deep relational metadata and state filters.' },
  { label: 'Calendar', icon: CalendarDays, copy: 'Get structural, multi-dimensional views of key sprint deadlines and operational dates.' },
];

// Fictional customer names — the reference design listed real companies
// (Linear, Notion, Stripe, Figma, Retool, Vercel, Vanta) as "trusted by"
// logos. Presenting real companies as verified WorkSync customers would be
// a false claim about them, so this uses invented names instead.
const LOGOS = ['Nova Systems', 'Brightline', 'Fjord Labs', 'Cascade', 'Ember & Co', 'Northwind', 'Solstice'];

// Fictional testimonials — the reference attributed one quote to Marc
// Andreessen, a real public figure. Fabricating an endorsement from a real
// person isn't something to reproduce, so this uses an invented persona in
// the same seat instead.
const TESTIMONIALS = [
  {
    quote: "WorkSync completely stripped the visual noise from our design sprints. It's the first work management platform that feels designed for fast, focused engineers and designers.",
    name: 'Priya Raman',
    role: 'VP of Product, Apex Studio',
  },
  {
    quote: 'No bloated setup screens or mandatory fields. Our agency adopted WorkSync in an afternoon and we immediately cut our sync alignment overhead by half.',
    name: 'Juliana Thorne',
    role: 'Managing Director, Haptic Design',
  },
  {
    quote: "Keyboard shortcuts and structured lists keep us extremely fast. It strikes the perfect balance between Notion's fluidity and Linear's deep operational speed.",
    name: 'David Vance',
    role: 'Tech Lead, Infrastructure Group',
  },
];

function SectionLabel({ children }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-mono uppercase tracking-widest">
      {children}
    </span>
  );
}

function ProductPreview() {
  return (
    <div className="w-full max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[220px_1fr] text-left">
      <div className="bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-slate-300" />
          <span className="text-sm font-semibold text-slate-800">Acme Corp</span>
        </div>
        <nav className="flex flex-col gap-0.5 text-xs text-slate-500">
          <span className="px-2 py-1.5">Inbox</span>
          <span className="px-2 py-1.5 rounded-md bg-slate-200/70 text-slate-800 font-medium">My Tasks</span>
          <span className="px-2 py-1.5">Calendar</span>
          <span className="px-2 py-1.5">Reporting</span>
        </nav>
        <div className="pt-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Workspaces</p>
          <div className="flex flex-col gap-0.5 text-xs text-slate-600">
            <span className="px-2 py-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Website Redesign</span>
            <span className="px-2 py-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Mobile App</span>
            <span className="px-2 py-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Q4 Marketing</span>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Website Redesign</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Share</span>
            <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold">New Task</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-2">To Do &middot; 2</p>
            <div className="flex flex-col gap-2">
              <div className="border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs font-medium text-slate-800">Review mobile navigation</p>
                <span className="text-[10px] text-slate-400">Design &middot; Medium</span>
              </div>
              <div className="border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs font-medium text-slate-800">Prepare design handoff docs</p>
                <span className="text-[10px] text-slate-400">Product &middot; Low</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-2">In Progress &middot; 1</p>
            <div className="border border-slate-200 rounded-lg p-2.5">
              <p className="text-xs font-medium text-slate-800">Finalize homepage wireframes</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">High</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-2">Done &middot; 2</p>
            <div className="flex flex-col gap-2">
              <div className="border border-slate-200 rounded-lg p-2.5 opacity-70">
                <p className="text-xs font-medium text-slate-800">Set up analytics tracking</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">High</span>
              </div>
              <div className="border border-slate-200 rounded-lg p-2.5 opacity-70">
                <p className="text-xs font-medium text-slate-800">Benchmark performance indicators</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-8 py-4">
          <NavLink to="/">
            <WorkSyncLogo className="h-8 w-auto" textClassName="text-lg font-bold text-slate-900 tracking-tight" />
          </NavLink>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#product" className="hover:text-slate-900 transition-colors">Product</a>
            <a href="#solutions" className="hover:text-slate-900 transition-colors">Solutions</a>
            <a href="#resources" className="hover:text-slate-900 transition-colors">Resources</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-5">
            <NavLink to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Log in
            </NavLink>
            <NavLink to="/register">
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Get Started
              </button>
            </NavLink>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 lg:px-8 pt-20 pb-24 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-6">
          <SectionLabel>Introducing WorkSync 2.0</SectionLabel>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Work better together. Ship faster.
          </h1>
          <p className="text-base text-slate-500 max-w-2xl leading-relaxed">
            Deserving teams shouldn't be held back by clunky setups. WorkSync delivers linear-level precision with
            document-like simplicity to orchestrate complex operations.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <NavLink to="/register">
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                Get Started Free
              </button>
            </NavLink>
            <a href="#product">
              <button className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                See How It Works
              </button>
            </a>
          </div>
        </div>

        <div className="mt-16" id="product">
          <ProductPreview />
        </div>
      </section>

      {/* Trusted by */}
      <section className="px-6 lg:px-8 py-10 border-b border-slate-200">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Trusted by high-performing teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {LOGOS.map((name) => (
              <span key={name} className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <span className="w-3.5 h-3.5 rounded-sm bg-slate-300" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Ship on time, every time */}
      <section className="px-6 lg:px-8 py-24">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center mb-14">
          <SectionLabel>The workflow blueprint</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ship on time, every time</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Our sequential workflow engine moves your projects seamlessly from early architectural blueprinting to
            active release tracking.
          </p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-blue-600">{step.n}</span>
                <step.icon className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{step.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Designed for complex workflows */}
      <section className="px-6 lg:px-8 py-24 bg-slate-50/60 border-y border-slate-200">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center mb-14">
          <SectionLabel>Platform capabilities</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Designed for complex workflows</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Every tool you need to run high-impact projects at scale. No bloated configuration or useless clutter.
          </p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
              <div className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700">
                <cap.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{cap.label}</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{cap.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* A premium engine for delivery */}
      <section className="px-6 lg:px-8 py-24">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 text-center mb-14">
          <SectionLabel>The interface</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">A premium engine for delivery</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Organize complex backlogs, define priority constraints, and keep teams laser-focused on real-time task
            progress.
          </p>
        </div>
        <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_120px_100px] px-5 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            <span>Task name</span>
            <span>Priority</span>
            <span>Assignee</span>
            <span>Timeline</span>
          </div>
          {[
            { title: 'Finalize homepage wireframes', priority: 'High', cls: 'bg-amber-50 text-amber-700', who: 'Alex M.', when: 'Oct 24' },
            { title: 'Review mobile navigation benchmarks', priority: 'Medium', cls: 'bg-blue-50 text-blue-700', who: 'Sarah K.', when: 'Oct 26' },
            { title: 'Prepare design handoff assets for engineering', priority: 'Low', cls: 'bg-slate-100 text-slate-600', who: 'Dave T.', when: 'Nov 01' },
          ].map((row) => (
            <div key={row.title} className="grid grid-cols-[1fr_100px_120px_100px] px-5 py-3.5 border-b border-slate-100 last:border-0 items-center">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded border border-slate-300 shrink-0" />
                <span className="text-xs font-medium text-slate-800">{row.title}</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded w-fit ${row.cls}`}>{row.priority}</span>
              <span className="text-xs text-slate-500">{row.who}</span>
              <span className="text-xs text-slate-400 font-mono">{row.when}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Never lose another detail */}
      <section className="px-6 lg:px-8 py-24 bg-slate-50/60 border-y border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Never lose another detail</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Keep project communication right next to the delivery lines. Threaded mentions, document attachments,
              and full version changelogs stay directly pinned on the task timeline.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">@Mentions & notification subscriptions</p>
                  <p className="text-xs text-slate-500 mt-0.5">Tag key stakeholders directly inside markdown description templates.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Dynamic task event logs</p>
                  <p className="text-xs text-slate-500 mt-0.5">Review complete status alterations, changes in ownership, and timeline delays.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-4">Project activity</p>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <p className="text-xs text-slate-700"><span className="font-semibold">Sarah K.</span> changed priority to High<br /><span className="text-slate-400">Review mobile navigation</span></p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">10m ago</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <p className="text-xs text-slate-700"><span className="font-semibold">Alex M.</span> commented<br /><span className="text-slate-400">@Liam F. let's check optimization bundles.</span></p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">1h ago</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <p className="text-xs text-slate-700"><span className="font-semibold">System</span> deployed build passing<br /><span className="text-slate-400">Vercel live deployment success</span></p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">3h ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Never miss a release milestone */}
      <section className="px-6 lg:px-8 py-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="bg-white border border-slate-200 rounded-xl p-5 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-900">October 2024</p>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-400"><ChevronLeft className="w-3 h-3" /></span>
                <span className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-400"><ChevronRight className="w-3 h-3" /></span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { d: 'Mon', n: 23 },
                { d: 'Tue', n: 24, tag: { label: 'Homepage WF', cls: 'bg-blue-50 text-blue-700' } },
                { d: 'Wed', n: 25 },
                { d: 'Thu', n: 26, tag: { label: 'Review Nav', cls: 'bg-amber-50 text-amber-700' } },
                { d: 'Fri', n: 27 },
              ].map((day) => (
                <div key={day.d} className="border border-slate-100 rounded-lg p-2 h-20 flex flex-col gap-1">
                  <span className="text-[9px] text-slate-400">{day.d}</span>
                  <span className="text-xs text-slate-700">{day.n}</span>
                  {day.tag && <span className={`text-[8px] px-1 py-0.5 rounded ${day.tag.cls}`}>{day.tag.label}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Never miss a release milestone</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Unify cross-department timelines within an elegant, fluid calendar system. Keep visual track of
              deliverable lifecycles without shifting browser tabs or context.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Weekly & monthly sprint horizons</p>
                  <p className="text-xs text-slate-500 mt-0.5">Easily shift granular scope views from immediate dailies to broad system cycles.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Direct calendar-to-task operations</p>
                  <p className="text-xs text-slate-500 mt-0.5">Adjust dates inside chronological cards by dragging, dropping, or rewriting deadlines.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 lg:px-8 py-24 bg-slate-50/60 border-y border-slate-200">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center mb-14">
          <SectionLabel>User voices</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Loved by builders who value clarity</h2>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-6">
              <p className="text-sm text-slate-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 lg:px-8 py-24">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-5">
          <SectionLabel>Get started today</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to streamline your workflow?</h2>
          <p className="text-sm text-slate-500 max-w-lg">
            Unify your team operations and ship projects with extreme operational clarity. Free up to 10 users
            forever.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <NavLink to="/register">
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                Get Started Free
              </button>
            </NavLink>
            <a href="mailto:sales@work.sync">
              <button className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                Talk to Sales
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-8 py-14 border-t border-slate-200">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 mb-10">
          <div className="col-span-2 flex flex-col gap-3">
            <WorkSyncLogo className="h-7 w-auto" textClassName="text-base font-bold text-slate-900" />
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              A premium, high-density work management system tailored for precise agencies, product teams, and
              modern enterprises.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Product</p>
            <a href="#product" className="text-slate-600 hover:text-slate-900">Features</a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900">Pricing</a>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Company</p>
            <a href="#about" className="text-slate-600 hover:text-slate-900">About Us</a>
            <a href="#careers" className="text-slate-600 hover:text-slate-900">Careers</a>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Legal</p>
            <a href="#privacy" className="text-slate-600 hover:text-slate-900">Privacy Policy</a>
            <a href="#terms" className="text-slate-600 hover:text-slate-900">Terms of Service</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-100 text-xs text-slate-400">
          &copy; 2026 WorkSync Technologies Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
