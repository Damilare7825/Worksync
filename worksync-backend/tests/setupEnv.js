// Test environment configuration
// Provides deterministic test defaults for required environment variables so tests
// do not depend on a developer's private .env file.
// These are test-only non-production values.

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/worksync_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-at-least-32-chars-long-for-testing-only-123456';
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'LOCAL';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
