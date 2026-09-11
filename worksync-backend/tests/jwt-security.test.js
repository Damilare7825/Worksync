import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../src/utils/jwt.js';

describe('JWT hardening', () => {
  test('access tokens have the default fifteen-minute lifetime and minimal claims', () => {
    const token = signToken({ userId: 'user-1', sessionId: 'session-1' });
    const payload = jwt.decode(token);

    expect(payload.exp - payload.iat).toBe(15 * 60);
    expect(payload).toMatchObject({ userId: 'user-1', sessionId: 'session-1' });
    expect(payload.email).toBeUndefined();
    expect(payload.passwordHash).toBeUndefined();
  });

  test('verification rejects unsigned and non-HS256 JWTs', () => {
    const unsigned = jwt.sign({ userId: 'user-1', sessionId: 'session-1' }, '', { algorithm: 'none' });
    expect(() => verifyToken(unsigned)).toThrow();
  });
});
