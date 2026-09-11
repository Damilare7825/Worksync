import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Grid,
  FolderKanban,
  CheckSquare,
  Calendar,
  Bell,
  Users,
  HelpCircle,
  Settings,
  LogOut,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { WORKSPACE_ROLE_LABELS } from '../../data/uiConfig.js';
import { WorkSyncLogo } from '../common/WorkSyncLogo';

export function Sidebar({ open, onClose }) {
  const { user, activeMembership, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/workspaces', label: 'Workspaces', icon: Grid },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/team', label: 'Members', icon: Users },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const content = (
    <>
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 mb-2">
        <WorkSyncLogo className="h-7 w-auto" textClassName="font-bold text-xl text-[#e5e2e3] tracking-tight" />
        {open && (
          <button
            onClick={onClose}
            className="ml-auto lg:hidden text-[#cbc3d7] hover:text-[#e5e2e3] p-1 rounded-lg hover:bg-[#2a2a2b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-200 group ${
                isActive
                  ? 'bg-[#a078ff] text-white font-semibold shadow-md'
                  : 'text-[#cbc3d7] hover:bg-[#2a2a2b] hover:text-[#e5e2e3]'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0 opacity-80 group-hover:opacity-100" />
            <span className="font-medium text-xs tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Footer Section */}
      <div className="mt-auto p-3 space-y-1 border-t border-[#353436]/40">
        <NavLink
          to="/help"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-[#cbc3d7] hover:bg-[#2a2a2b] hover:text-[#e5e2e3] transition-all ${
              isActive ? 'bg-[#2a2a2b] text-white font-semibold' : ''
            }`
          }
        >
          <HelpCircle className="w-4 h-4 opacity-70" />
          <span className="font-medium">Help Center</span>
        </NavLink>

        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-[#cbc3d7] hover:bg-[#2a2a2b] hover:text-[#e5e2e3] transition-all ${
              isActive ? 'bg-[#2a2a2b] text-white font-semibold' : ''
            }`
          }
        >
          <Settings className="w-4 h-4 opacity-70" />
          <span className="font-medium">Settings</span>
        </NavLink>

        {/* User Card */}
        <div className="flex items-center gap-3 px-3 py-3 mt-2 bg-[#1c1b1c] rounded-xl border border-[#353436]/40">
          <div className="w-8 h-8 rounded-full bg-[#d0bcff] flex items-center justify-center text-[#3c0091] font-bold text-xs shrink-0 shadow-sm">
            <User className="w-4 h-4 text-[#3c0091]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#e5e2e3] truncate font-semibold">{user?.name || ''}</p>
            <p className="text-[10px] text-[#cbc3d7] truncate uppercase tracking-widest font-semibold">
              {activeMembership ? WORKSPACE_ROLE_LABELS[activeMembership.role] : 'Member'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="text-[#cbc3d7] hover:text-rose-400 p-1 rounded-lg hover:bg-[#353436] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0e0e0f] z-50 hidden lg:flex flex-col border-r border-[#353436]/40 shadow-xl select-none">
        {content}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-[240px] bg-[#0e0e0f] z-50 flex flex-col border-r border-[#353436]/40 shadow-xl select-none
          transition-transform duration-300 ease-in-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {content}
      </aside>
    </>
  );
}
