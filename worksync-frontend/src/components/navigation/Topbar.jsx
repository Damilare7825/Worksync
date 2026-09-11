import React, { useState } from 'react';
import { Bell, Plus, Folder, ChevronRight, User, Check, AlertTriangle, MessageSquare, UserPlus, Menu } from 'lucide-react';
import { useWorkSync } from '../../context/WorkSyncContext';
import { useAuth } from '../../context/AuthContext';
import { GlobalSearch } from '../common/GlobalSearch';
import { InvitationNotificationModal } from '../team/InvitationNotificationModal';

export function Topbar({ title, subtitle, onMenuClick }) {
  const {
    setIsTaskModalOpen,
    setEditingTask,
    notifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useWorkSync();
  const { activeWorkspace } = useAuth();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => n.unread).length;
  const [openInvitationId, setOpenInvitationId] = useState(null);

  const handleNotifClick = (n) => {
    markNotificationRead(n.id);
    if (n.type === 'INVITATION' && n.invitationId) {
      setIsNotifOpen(false);
      setOpenInvitationId(n.invitationId);
    }
  };

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'ALERT':
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'COMMENT':
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'PROJECT_UPDATE':
      case 'project':
        return <Folder className="w-4 h-4 text-indigo-400" />;
      case 'INVITATION':
        return <UserPlus className="w-4 h-4 text-indigo-400" />;
      default:
        return <Check className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <header className="fixed top-0 left-[240px] right-0 h-16 bg-[#131314]/80 backdrop-blur-xl z-40 flex items-center justify-between px-8 shadow-xs border-b border-[#353436]/30">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 text-[#cbc3d7] text-xs font-medium">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden text-[#cbc3d7] hover:text-[#e5e2e3] p-1 rounded-lg hover:bg-[#2a2a2b] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Folder className="w-4 h-4 text-[#cbc3d7]" />
        <span>Workspaces</span>
        <ChevronRight className="w-3.5 h-3.5 text-[#cbc3d7]/60" />
        <span className="text-[#e5e2e3] font-semibold tracking-tight">{title || activeWorkspace?.name || ''}</span>
      </div>

      {/* Global Search Command Palette */}
      <div className="flex-1 max-w-xl px-12">
        <GlobalSearch />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Create Task Button */}
        <button
          onClick={handleOpenNewTask}
          className="bg-[#d0bcff] text-[#3c0091] p-2 rounded-full hover:shadow-[0_0_20px_rgba(208,188,255,0.3)] transition-all flex items-center justify-center cursor-pointer"
          title="New Task"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="text-[#cbc3d7] hover:text-[#e5e2e3] transition-colors relative p-1.5 cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ffb4ab] rounded-full border-2 border-[#131314]" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#1c1b1c] rounded-2xl shadow-2xl border border-[#353436] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#353436]">
                <span className="text-[11px] font-bold text-[#cbc3d7] uppercase tracking-wider">
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-[#d0bcff] hover:underline font-medium cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#353436]/50">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#cbc3d7]">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`p-3 flex gap-3 hover:bg-[#2a2a2b] transition-colors cursor-pointer ${
                        n.unread ? 'bg-[#a078ff]/10' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#2a2a2b] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#353436]">
                        {getNotifIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#e5e2e3]">{n.title}</p>
                        <p className="text-xs text-[#cbc3d7] line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-[#cbc3d7]/60 mt-1">{n.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#d0bcff] flex items-center justify-center text-[#3c0091] shadow-sm">
          <User className="w-4 h-4 text-[#3c0091]" />
        </div>
      </div>

      {openInvitationId && (
        <InvitationNotificationModal
          invitationId={openInvitationId}
          onClose={() => setOpenInvitationId(null)}
        />
      )}
    </header>
  );
}
