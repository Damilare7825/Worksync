import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Input, Select } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext.jsx';
import { userApi } from '../api/user.api.js';
import { authApi } from '../api/auth.api.js';
import { workspaceApi } from '../api/workspace.api.js';
import { WORKSPACE_ROLE_LABELS } from '../data/uiConfig.js';
import { ActivityFeed } from '../components/activity/ActivityFeed.jsx';

// "Job Title", "Department", and a granular per-provider Integrations
// panel appear in the reference design, but there's no backing field or
// feature for any of them (User model only has name/bio/avatar; there is
// no integrations model or route anywhere in the backend). Rather than
// fake fields that silently do nothing when saved, those are omitted —
// see the Integrations tab below for how that gap is surfaced honestly.
const TABS = ['Profile', 'Account', 'Preferences', 'Notifications', 'Security', 'Workspace', 'Members', 'Integrations'];

export function Settings() {
  const {
    user,
    setUser,
    activeMembership,
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    refreshWorkspaces,
    switchWorkspace,
  } = useAuth();
  const isWorkspaceAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';
  const isWorkspaceOwner = activeMembership?.role === 'OWNER';
  const [activeTab, setActiveTab] = useState('Profile');
  const visibleTabs = TABS.filter((t) => t !== 'Workspace' || isWorkspaceOwner);

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  // Workspace settings state
  const [wsName, setWsName] = useState(activeWorkspace?.name || '');
  const [wsLoading, setWsLoading] = useState(false);
  const [wsError, setWsError] = useState('');
  const [wsSaved, setWsSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState('');
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Notification preferences state
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = useState(true);
  const [notificationPreferencesError, setNotificationPreferencesError] = useState('');
  const [notificationPreferencesSaved, setNotificationPreferencesSaved] = useState(false);

  useEffect(() => {
    setWsName(activeWorkspace?.name || '');
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  useEffect(() => {
    loadPreferences();
    loadNotificationPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setPreferencesLoading(true);
      setPreferencesError('');
      const res = await userApi.getPreferences();
      setPreferences(res.data.preferences);
    } catch (err) {
      setPreferencesError(err.message || 'Could not load preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const loadNotificationPreferences = async () => {
    try {
      setNotificationPreferencesLoading(true);
      setNotificationPreferencesError('');
      const res = await userApi.getNotificationPreferences();
      setNotificationPreferences(res.data.preferences);
    } catch (err) {
      setNotificationPreferencesError(err.message || 'Could not load notification preferences');
    } finally {
      setNotificationPreferencesLoading(false);
    }
  };

  const handleWorkspaceRename = async (e) => {
    e.preventDefault();
    setWsLoading(true);
    setWsError('');
    try {
      await workspaceApi.update(activeWorkspaceId, { name: wsName });
      await refreshWorkspaces();
      setWsSaved(true);
      setTimeout(() => setWsSaved(false), 3000);
    } catch (err) {
      setWsError(err.message || 'Could not save workspace settings');
    } finally {
      setWsLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    await workspaceApi.remove(activeWorkspaceId);
    const remaining = workspaces.filter((w) => w.id !== activeWorkspaceId);
    await refreshWorkspaces();
    // Land somewhere valid — another workspace if the user has one, or
    // nothing selected otherwise; downstream routing already handles an
    // unset active workspace by sending the user to pick/create one.
    switchWorkspace(remaining[0]?.id || null);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await userApi.updateProfile({ name, bio });
      setUser(res.data.user);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Could not save profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      // Preview the image
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      if (avatarFile) {
        const res = await userApi.uploadAvatar(avatarFile);
        // Update the user's avatar URL in state
        setAvatarUrl(res.data.avatar || '');
        setUser(prev => ({
          ...prev,
          avatar: res.data.avatar || ''
        }));
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Could not save avatar');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarRemove = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      await userApi.deleteAvatar();
      // Remove the avatar from state
      setAvatarUrl('');
      setAvatarFile(null);
      setAvatarPreview(null);
      setUser(prev => ({
        ...prev,
        avatar: null
      }));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Could not remove avatar');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError('');
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err.message || 'Could not change password');
    } finally {
      setPwLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e) => {
    e.preventDefault();
    setPreferencesLoading(true);
    setPreferencesError('');
    try {
      const res = await userApi.updatePreferences(preferences);
      setPreferences(res.data.preferences);
      setPreferencesSaved(true);
      setTimeout(() => setPreferencesSaved(false), 3000);
    } catch (err) {
      setPreferencesError(err.message || 'Could not save preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleNotificationPreferencesSubmit = async (e) => {
    e.preventDefault();
    setNotificationPreferencesLoading(true);
    setNotificationPreferencesError('');
    try {
      const res = await userApi.updateNotificationPreferences(notificationPreferences);
      setNotificationPreferences(res.data.preferences);
      setNotificationPreferencesSaved(true);
      setTimeout(() => setNotificationPreferencesSaved(false), 3000);
    } catch (err) {
      setNotificationPreferencesError(err.message || 'Could not save notification preferences');
    } finally {
      setNotificationPreferencesLoading(false);
    }
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your personal profile and workspace settings">
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          {/* Tab sidebar */}
          <nav className="lg:w-48 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 max-w-2xl space-y-6">
            {activeTab === 'Profile' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Profile Settings</h3>
                <p className="text-xs text-slate-500 pt-3">This information will be displayed to other team members.</p>
                <form onSubmit={handleProfileSubmit} className="space-y-4 pt-4">
                  {profileSaved && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      Profile changes saved successfully!
                    </div>
                  )}
                  {profileError && (
                    <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{profileError}</div>
                  )}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="shrink-0">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar preview" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold">
                            {(user?.name || '').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <Input label="Avatar Image" type="file" onChange={handleAvatarChange} />
                        <div className="flex gap-2 mt-2">
                          {avatarFile && (
                            <Button variant="secondary" size="sm" onClick={handleAvatarSubmit}>
                              Upload Avatar
                            </Button>
                          )}
                          {(avatarUrl || avatarPreview) && (
                            <Button variant="secondary" size="sm" onClick={handleAvatarRemove}>
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">JPG, GIF or PNG.</p>
                      </div>
                    </div>
                    <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <Input label="Bio/About" value={bio} onChange={(e) => setBio(e.target.value)} textarea />
                    <div className="pt-2">
                      <Button type="submit" variant="primary" disabled={profileLoading}>
                        {profileLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            )}

            {activeTab === 'Account' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Account</h3>
                <div className="space-y-4 pt-4">
                  <Input label="Email Address" type="email" value={user?.email || ''} disabled />
                  {activeMembership && (
                    <Select
                      label="Workspace Role"
                      value={activeMembership.role}
                      disabled
                      options={[{ value: activeMembership.role, label: WORKSPACE_ROLE_LABELS[activeMembership.role] }]}
                    />
                  )}
                  <p className="text-xs text-slate-400">
                    Need to change your email? That's not self-serve yet — contact a workspace owner.
                  </p>
                </div>
              </Card>
            )}

            {activeTab === 'Preferences' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Preferences</h3>
                <form onSubmit={handlePreferencesSubmit} className="space-y-4 pt-4">
                  {preferencesSaved && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      Preferences saved successfully!
                    </div>
                  )}
                  {preferencesError && (
                    <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{preferencesError}</div>
                  )}
                  {preferencesLoading ? (
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold">Loading preferences...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-800">Theme</p>
                        <div className="flex space-x-4">
                          {['LIGHT', 'DARK', 'SYSTEM'].map((mode) => (
                            <label key={mode} className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                              <input
                                type="radio"
                                checked={preferences?.theme === mode}
                                onChange={(e) => setPreferences((prev) => ({ ...prev, theme: e.target.value }))}
                                value={mode}
                              />
                              <span className="capitalize">{mode.toLowerCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <Input
                        label="Timezone"
                        value={preferences?.timezone || 'UTC'}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, timezone: e.target.value }))}
                      />
                      <Input
                        label="Date Format"
                        value={preferences?.dateFormat || 'MM/dd/yyyy'}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, dateFormat: e.target.value }))}
                      />
                      <Input
                        label="Time Format"
                        value={preferences?.timeFormat || 'hh:mm a'}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, timeFormat: e.target.value }))}
                      />
                      <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={preferences?.compactDensity || false}
                          onChange={(e) => setPreferences((prev) => ({ ...prev, compactDensity: e.target.checked }))}
                        />
                        <span>Compact layout</span>
                      </label>

                      <div className="pt-2">
                        <Button type="submit" variant="primary" disabled={preferencesLoading}>
                          {preferencesLoading ? 'Saving...' : 'Save Preferences'}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              </Card>
            )}

            {activeTab === 'Notifications' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Notification Preferences</h3>
                <form onSubmit={handleNotificationPreferencesSubmit} className="space-y-5 pt-4">
                  {notificationPreferencesSaved && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      Notification preferences saved successfully!
                    </div>
                  )}
                  {notificationPreferencesError && (
                    <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{notificationPreferencesError}</div>
                  )}
                  {notificationPreferencesLoading ? (
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold">Loading...</div>
                  ) : (
                    <div className="space-y-5">
                      <NotifGroup title="Task Activity">
                        <NotifCheck label="Task assignments" checked={notificationPreferences?.taskAssignments ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, taskAssignments: v }))} />
                        <NotifCheck label="Task updates" checked={notificationPreferences?.taskUpdates ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, taskUpdates: v }))} />
                        <NotifCheck label="Due date reminders" checked={notificationPreferences?.dueDateReminders ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, dueDateReminders: v }))} />
                      </NotifGroup>
                      <NotifGroup title="Discussions">
                        <NotifCheck label="Mentions" checked={notificationPreferences?.mentions ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, mentions: v }))} />
                        <NotifCheck label="Comments" checked={notificationPreferences?.comments ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, comments: v }))} />
                        <NotifCheck label="Replies" checked={notificationPreferences?.replies ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, replies: v }))} />
                        <NotifCheck label="Reactions" checked={notificationPreferences?.reactions ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, reactions: v }))} />
                      </NotifGroup>
                      <NotifGroup title="Workspace & Project">
                        <NotifCheck label="Workspace activity" checked={notificationPreferences?.workspaceActivity ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, workspaceActivity: v }))} />
                        <NotifCheck label="Project activity" checked={notificationPreferences?.projectActivity ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, projectActivity: v }))} />
                        <NotifCheck label="Invitations" checked={notificationPreferences?.invitations ?? true} onChange={(v) => setNotificationPreferences((prev) => ({ ...prev, invitations: v }))} />
                      </NotifGroup>
                      <div className="pt-2">
                        <Button type="submit" variant="primary" disabled={notificationPreferencesLoading}>
                          {notificationPreferencesLoading ? 'Saving...' : 'Save Notification Preferences'}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              </Card>
            )}

            {activeTab === 'Security' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Change Password</h3>
                <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-4">
                  {pwSaved && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      Password changed successfully!
                    </div>
                  )}
                  {pwError && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{pwError}</div>}
                  <Input
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <div className="pt-2">
                    <Button type="submit" variant="primary" disabled={pwLoading}>
                      {pwLoading ? 'Updating...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {activeTab === 'Workspace' && isWorkspaceOwner && activeWorkspace && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Workspace Settings</h3>
                <form onSubmit={handleWorkspaceRename} className="space-y-4 pt-4">
                  {wsSaved && (
                    <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      Workspace settings saved successfully!
                    </div>
                  )}
                  {wsError && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{wsError}</div>}
                  <Input label="Workspace Name" value={wsName} onChange={(e) => setWsName(e.target.value)} required minLength={2} />
                  <div className="pt-2">
                    <Button type="submit" variant="primary" disabled={wsLoading}>
                      {wsLoading ? 'Saving...' : 'Save Workspace Settings'}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-rose-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-2">Danger Zone</p>
                  <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-rose-50/60 border border-rose-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Delete this workspace</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Permanently deletes the workspace, its projects, tasks, and all member access. This cannot be undone.
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {activeWorkspaceId && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <p className="text-sm font-bold text-slate-900 mb-3">
                      Workspace Activity{isWorkspaceAdmin ? ' & Audit Log' : ''}
                    </p>
                    <ActivityFeed scope="workspace" scopeId={activeWorkspaceId} title="Recent Activity" showAuditToggle={isWorkspaceAdmin} />
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'Members' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Members</h3>
                <p className="text-sm text-slate-500 pt-4 mb-4">
                  Manage roles, invitations, and access from the dedicated Team page.
                </p>
                <NavLink to="/team">
                  <Button variant="primary">Go to Team</Button>
                </NavLink>
              </Card>
            )}

            {activeTab === 'Integrations' && (
              <Card>
                <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">Integrations</h3>
                <div className="pt-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">No integrations available yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    WorkSync doesn't connect to any external tools yet — this is on the roadmap, not wired up to
                    anything today.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteWorkspace}
        title="Delete workspace"
        description={`This permanently deletes "${activeWorkspace?.name}", including every project, task, comment, and member's access. This cannot be undone.`}
        confirmLabel="Delete workspace"
        variant="danger"
        requireTextMatch={activeWorkspace?.name}
      />
    </AppLayout>
  );
}

function NotifGroup({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function NotifCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}