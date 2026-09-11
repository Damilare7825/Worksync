import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { WorkSyncProvider } from './context/WorkSyncContext.jsx';
import { ProtectedRoute, GuestRoute } from './components/routing/ProtectedRoute.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';

import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { Onboarding } from './pages/Onboarding.jsx';
import { SelectWorkspace } from './pages/SelectWorkspace.jsx';
import { AcceptInvitation } from './pages/AcceptInvitation.jsx';
import { JoinWorkspace } from './pages/JoinWorkspace.jsx';

import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail.jsx';
import { KanbanPage } from './pages/KanbanPage';
import { CalendarPage } from './pages/CalendarPage';
import { Reports } from './pages/Reports';
import { TeamPage } from './pages/TeamPage';
import { Settings } from './pages/Settings';
import { Workspaces } from './pages/Workspaces';
import { Notifications } from './pages/Notifications';
import { HelpCenter } from './pages/HelpCenter';

function WorkspaceScope() {
  return (
    <WorkSyncProvider>
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
    </WorkSyncProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
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
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
