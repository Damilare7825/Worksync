import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../api/auth.api.js';
import { workspaceApi } from '../api/workspace.api.js';
import { getToken, setToken, clearToken, registerUnauthorizedHandler } from '../api/http.js';
import { rememberAccount } from '../utils/rememberedAccounts.js';
import { getPendingInvitation, pendingInvitationPath } from '../utils/pendingInvitation.js';

const AuthContext = createContext(null);

const ACTIVE_WORKSPACE_KEY = 'worksync_active_workspace_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => localStorage.getItem(ACTIVE_WORKSPACE_KEY) || null
  );
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const clearSession = useCallback(() => {
    clearToken();
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSession();
      setStatus('ready');
    });
  }, [clearSession]);

  const loadWorkspaces = useCallback(async () => {
    const res = await workspaceApi.list();
    const list = res.data.workspaces;
    setWorkspaces(list);
    return list;
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      // Access tokens are intentionally memory-only. A page load obtains a
      // fresh one using the browser-managed HttpOnly refresh cookie.
      if (!getToken()) {
        const refreshed = await authApi.refresh();
        setToken(refreshed.data.token);
      }
      const meRes = await authApi.me();
      setUser(meRes.data.user);
      const list = await loadWorkspaces();
      const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      const stillValid = savedId && list.some((w) => w.id === savedId);
      setActiveWorkspaceId(stillValid ? savedId : list[0]?.id || null);
    } catch {
      clearSession();
    } finally {
      setStatus('ready');
    }
  }, [loadWorkspaces, clearSession]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      setError('');
      const res = await authApi.login({ email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      rememberAccount(res.data.user);
      const list = await loadWorkspaces();
      setActiveWorkspaceId(list[0]?.id || null);
      const pendingPath = pendingInvitationPath(getPendingInvitation());
      return { hasWorkspace: list.length > 0, pendingInvitationPath: pendingPath };
    },
    [loadWorkspaces]
  );

  const register = useCallback(async ({ name, email, password }) => {
    setError('');
    const res = await authApi.register({ name, email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    rememberAccount(res.data.user);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    const pendingPath = pendingInvitationPath(getPendingInvitation());
    return { hasWorkspace: false, pendingInvitationPath: pendingPath };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout is best-effort server-side; clear locally regardless.
    }
    clearSession();
  }, [clearSession]);

  const createWorkspace = useCallback(
    async (name) => {
      const res = await workspaceApi.create(name);
      const created = res.data.workspace;
      await loadWorkspaces();
      setActiveWorkspaceId(created.id);
      return created;
    },
    [loadWorkspaces]
  );

  const switchWorkspace = useCallback((workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  const value = {
    user,
    setUser,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    activeMembership: activeWorkspace?.membership || null,
    status,
    isAuthenticated: Boolean(user),
    error,
    login,
    register,
    logout,
    createWorkspace,
    switchWorkspace,
    refreshWorkspaces: loadWorkspaces,
    switchAccount: clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
