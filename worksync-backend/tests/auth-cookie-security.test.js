import { jest } from '@jest/globals';

let controller;
let authService;

beforeAll(async () => {
  authService = {
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    refreshAccessToken: jest.fn(),
    logoutUser: jest.fn(),
  };

  jest.unstable_mockModule('../src/services/auth.service.js', () => authService);
  jest.unstable_mockModule('../src/config/database.js', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
  controller = await import('../src/controllers/auth.controller.js');
});

function responseRecorder() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
}

describe('cookie-based refresh credentials', () => {
  test('login sets an HttpOnly refresh cookie and never returns it in JSON', async () => {
    authService.loginUser.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test' },
      token: 'short-lived-access-token',
      refreshToken: 'raw-refresh-credential',
    });
    const res = responseRecorder();

    await controller.login({ body: { email: 'user@example.test', password: 'Password123!' } }, res, jest.fn());

    expect(res.cookie).toHaveBeenCalledWith(
      'worksync_refresh_token',
      'raw-refresh-credential',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/v1/auth' })
    );
    expect(res.json.mock.calls[0][0].data).toEqual(expect.objectContaining({ token: 'short-lived-access-token' }));
    expect(res.json.mock.calls[0][0].data.refreshToken).toBeUndefined();
  });

  test('refresh reads only the HttpOnly cookie, rotates it, and rejects an untrusted origin', async () => {
    authService.refreshAccessToken.mockResolvedValue({
      token: 'new-access-token',
      refreshToken: 'rotated-refresh-credential',
    });
    const res = responseRecorder();
    const req = {
      headers: { cookie: 'worksync_refresh_token=old-refresh-credential' },
      get: jest.fn().mockReturnValue(undefined),
    };

    await controller.refresh(req, res, jest.fn());
    expect(authService.refreshAccessToken).toHaveBeenCalledWith('old-refresh-credential');
    expect(res.cookie).toHaveBeenCalledWith('worksync_refresh_token', 'rotated-refresh-credential', expect.any(Object));
    expect(res.json.mock.calls[0][0].data.refreshToken).toBeUndefined();

    const rejected = responseRecorder();
    const next = jest.fn();
    await controller.refresh({ headers: {}, get: jest.fn().mockReturnValue('https://untrusted.example') }, rejected, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: 'CSRF_ORIGIN_DENIED' }));
    expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
