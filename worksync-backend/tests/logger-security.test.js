import { sanitizeForLogging } from '../src/utils/logger.js';

describe('sensitive logging sanitization', () => {
  test('redacts every credential category recursively, including nested arrays', () => {
    const sanitized = sanitizeForLogging({
      password: 'value',
      passwordHash: 'value',
      token: 'value',
      accessToken: 'value',
      refreshToken: 'value',
      refresh_token: 'value',
      cookie: 'value',
      cookies: 'value',
      'set-cookie': 'value',
      authorization: 'value',
      'proxy-authorization': 'value',
      smtpPassword: 'value',
      smtp_password: 'value',
      smtppassword: 'value',
      smtp_pass: 'value',
      smtppass: 'value',
      pass: 'value',
      databaseUrl: 'value',
      database_url: 'value',
      DATABASE_URL: 'value',
      apiKey: 'value',
      api_key: 'value',
      API_KEY: 'value',
      secret: 'value',
      invitationToken: 'value',
      resetToken: 'value',
      nested: [{ refreshToken: 'value', database_url: 'value' }],
    });

    for (const key of Object.keys(sanitized)) {
      if (key !== 'nested') expect(sanitized[key]).toBe('[REDACTED]');
    }
    expect(sanitized.nested[0].refreshToken).toBe('[REDACTED]');
    expect(sanitized.nested[0].database_url).toBe('[REDACTED]');
  });

  test('preserves non-sensitive metadata and properties intact', () => {
    const input = {
      id: 'task-123',
      title: 'Deploy to production',
      status: 'COMPLETED',
      statusCode: 200,
      timestamp: '2026-09-10T12:00:00Z',
      template: 'WELCOME',
      subject: 'Welcome to WorkSync',
      user: {
        id: 'usr-1',
        email: 'user@example.com',
      },
    };

    const sanitized = sanitizeForLogging(input);
    expect(sanitized).toEqual(input);
  });
});
