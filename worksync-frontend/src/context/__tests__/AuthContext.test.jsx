import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import * as authApiModule from '../../api/auth.api.js';
import * as workspaceApiModule from '../../api/workspace.api.js';
import * as httpModule from '../../api/http.js';

function TestConsumer() {
  const { user, status, error, logout } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user ? user.name : 'none'}</div>
      {error && <div data-testid="error">{error}</div>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext and AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test('bootstraps in unauthenticated state when refresh fails', async () => {
    vi.spyOn(httpModule, 'getToken').mockReturnValue(null);
    vi.spyOn(authApiModule.authApi, 'refresh').mockRejectedValue(new Error('unauthenticated'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // After bootstrap settles
    expect(await screen.findByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('loads authenticated user when me and workspaces succeed', async () => {
    vi.spyOn(httpModule, 'getToken').mockReturnValue('mock-jwt-token');
    vi.spyOn(authApiModule.authApi, 'me').mockResolvedValue({
      data: { user: { id: 'u-1', name: 'Ada Lovelace', email: 'ada@worksync.test' } },
    });
    vi.spyOn(workspaceApiModule.workspaceApi, 'list').mockResolvedValue({
      data: { workspaces: [{ id: 'ws-1', name: 'Computing Lab' }] },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });
});
