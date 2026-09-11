import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';
import { TaskModal } from '../components/tasks/TaskModal';
import { ProjectModal } from '../components/projects/ProjectModal';
import { InviteMemberModal } from '../components/team/InviteMemberModal';
import { AmbientShaderBackground } from '../components/common/AmbientShaderBackground';

export function AppLayout({ children, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#131314] text-[#e5e2e3] selection:bg-[#d0bcff] selection:text-[#3c0091] relative overflow-hidden">
      {/* WebGL Ambient Background Shader */}
      <AmbientShaderBackground />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-[240px] relative z-10">
        <Topbar title={title} subtitle={subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="relative pt-16 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <TaskModal />
      <ProjectModal />
      <InviteMemberModal />
    </div>
  );
}
