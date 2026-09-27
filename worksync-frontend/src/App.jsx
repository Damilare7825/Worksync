import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { WorkSyncProvider } from './context/WorkSyncContext.jsx';
import { ProtectedRoute, GuestRoute } from './components/routing/ProtectedRoute.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';

// Code-split route pages using dynamic imports to optimize bundle size and load time
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx').then((m) => ({ default: m.ResetPassword })));
const Onboarding = lazy(() => import('./pages/Onboarding.jsx').then((m) => ({ default: m.Onboarding })));
const SelectWorkspace = lazy(() => import('./pages/SelectWorkspace.jsx').then((m) => ({ default: m.SelectWorkspace })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation.jsx').then((m) => ({ default: m.AcceptInvitation })));
const JoinWorkspace = lazy(() => import('./pages/JoinWorkspace.jsx').then((m) => ({ default: m.JoinWorkspace })));

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx').then((m) => ({ default: m.ProjectDetail })));
const KanbanPage = lazy(() => import('./pages/KanbanPage').then((m) => ({ default: m.KanbanPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Workspaces = lazy(() => import('./pages/Workspaces').then((m) => ({ default: m.Workspaces })));
const Notifications = lazy(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const HelpCenter = lazy(() => import('./pages/HelpCenter').then((m) => ({ default: m.HelpCenter })));

function PageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-sm font-medium text-slate-400">Loading...</span>
      </div>
    </div>
  );
}

function WorkspaceScope() {
  return (
    <WorkSyncProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="help" element={<HelpCenter />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </WorkSyncProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />

              <Route element={<GuestRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
              </Route>

              <Route path="/invitations/:token" element={<AcceptInvitation />} />
              <Route path="/join/:token" element={<JoinWorkspace />} />

              <Route element={<ProtectedRoute requireWorkspace={false} />}>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/select-workspace" element={<SelectWorkspace />} />
              </Route>

              <Route element={<ProtectedRoute requireWorkspace />}>
                <Route path="/*" element={<WorkspaceScope />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
