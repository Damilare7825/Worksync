import { validateEnv, ConfigurationError, OBVIOUSLY_INSECURE_JWT_SECRETS } from '../src/config/env.js';
import { emailService } from '../src/services/email/index.js';
import { env } from '../src/config/env.js';

describe('A4 Production Environment & Secret Management Hardening', () => {
  const validProductionEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://produser:StrongProdPassword123!@db.internal:5432/worksync_prod?sslmode=require',
    JWT_SECRET: 'super-secret-production-key-at-least-32-chars-long-123456',
    STORAGE_PROVIDER: 'S3',
    STORAGE_BUCKET: 'prod-bucket',
    STORAGE_REGION: 'auto',
    STORAGE_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
    STORAGE_ACCESS_KEY_ID: 'prod-access-key-id-98765',
    STORAGE_SECRET_ACCESS_KEY: 'prod-secret-access-key-54321',
    SMTP_HOST: 'smtp.sendgrid.net',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'apikey',
    SMTP_PASS: 'SG.strong-api-key-value',
    EMAIL_FROM: 'WorkSync <no-reply@worksync.app>',
  };

  describe('JWT validation', () => {
    test('production + missing JWT_SECRET is rejected', () => {
      const testEnv = { ...validProductionEnv, JWT_SECRET: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/Missing required environment variable: JWT_SECRET/i);
    });

    test('production + whitespace-only JWT_SECRET is rejected', () => {
      const testEnv = { ...validProductionEnv, JWT_SECRET: '     ' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
    });

    test('production + too short JWT_SECRET (< 32 chars) is rejected', () => {
      const testEnv = { ...validProductionEnv, JWT_SECRET: 'short-secret-123' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/min 32 chars/i);
    });

    test.each(OBVIOUSLY_INSECURE_JWT_SECRETS.filter(Boolean))(
      'production + obviously insecure placeholder "%s" is rejected',
      (placeholder) => {
        const testEnv = { ...validProductionEnv, JWT_SECRET: placeholder };
        expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      }
    );

    test('production + example pattern secret is rejected', () => {
      const testEnv = {
        ...validProductionEnv,
        JWT_SECRET: 'CHANGE_ME__GENERATE_A_LONG_RANDOM_SECRET_BEFORE_USE_12345',
      };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
    });

    test('development + insecure secret is permitted with warning', () => {
      const devEnv = {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/worksync',
        JWT_SECRET: 'dev-secret',
        STORAGE_PROVIDER: 'LOCAL',
      };

      expect(() => validateEnv(devEnv, { exitOnError: false })).not.toThrow();
      expect(validateEnv(devEnv, { exitOnError: false })).toBe(true);
    });
  });

  describe('Storage validation', () => {
    test('production + LOCAL storage provider is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_PROVIDER: 'LOCAL' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/must use STORAGE_PROVIDER=S3/i);
    });

    test('production + invalid STORAGE_PROVIDER is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_PROVIDER: 'GCS' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/must be LOCAL or S3/i);
    });

    test('production + S3 missing STORAGE_BUCKET is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_BUCKET: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/STORAGE_BUCKET/i);
    });

    test('production + S3 missing STORAGE_ACCESS_KEY_ID is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_ACCESS_KEY_ID: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/STORAGE_ACCESS_KEY_ID/i);
    });

    test('production + S3 missing STORAGE_SECRET_ACCESS_KEY is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_SECRET_ACCESS_KEY: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/STORAGE_SECRET_ACCESS_KEY/i);
    });

    test('production + S3 with placeholder credential is rejected', () => {
      const testEnv = { ...validProductionEnv, STORAGE_ACCESS_KEY_ID: 'YOUR_R2_ACCESS_KEY_ID' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/unconfigured placeholder/i);
    });
  });

  describe('Database validation', () => {
    test('missing DATABASE_URL is rejected in any environment', () => {
      const testEnv = { ...validProductionEnv, DATABASE_URL: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/Missing required environment variable: DATABASE_URL/i);
    });

    test('whitespace-only DATABASE_URL is rejected', () => {
      const testEnv = { ...validProductionEnv, DATABASE_URL: '   ' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
    });

    test('production + unconfigured placeholder DATABASE_URL is rejected', () => {
      const testEnv = {
        ...validProductionEnv,
        DATABASE_URL: 'postgresql://worksync:GENERATE_A_LONG_RANDOM_DATABASE_PASSWORD@postgres:5432/worksync?schema=public',
      };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/unconfigured placeholder/i);
    });
  });

  describe('Email validation', () => {
    test('production + missing SMTP_HOST is rejected', () => {
      const testEnv = { ...validProductionEnv, SMTP_HOST: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/SMTP_HOST/i);
    });

    test('production + missing EMAIL_FROM is rejected', () => {
      const testEnv = { ...validProductionEnv, EMAIL_FROM: '' };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/EMAIL_FROM/i);
    });

    test('production + unauthenticated SMTP relay (no user/pass) is allowed', () => {
      const relayEnv = {
        ...validProductionEnv,
        SMTP_USER: '',
        SMTP_PASS: '',
      };
      expect(() => validateEnv(relayEnv, { exitOnError: false })).not.toThrow();
      expect(validateEnv(relayEnv, { exitOnError: false })).toBe(true);
    });

    test('production + mismatched SMTP_USER without SMTP_PASS is rejected', () => {
      const testEnv = {
        ...validProductionEnv,
        SMTP_USER: 'some-user',
        SMTP_PASS: '',
      };
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(ConfigurationError);
      expect(() => validateEnv(testEnv, { exitOnError: false })).toThrow(/Both SMTP_USER and SMTP_PASS must be provided together/i);
    });

    test('production + MockEmailProvider fallback must not silently occur', async () => {
      const originalProd = env.isProduction;
      const originalHost = env.smtpHost;
      const originalFrom = env.emailFrom;

      try {
        env.isProduction = true;
        env.smtpHost = undefined;
        env.emailFrom = undefined;

        await expect(
          emailService.send({
            to: 'test@example.com',
            template: 'WELCOME',
            data: { name: 'Test', dashboardUrl: 'http://localhost/dashboard' },
          })
        ).rejects.toThrow(/missing SMTP_HOST/i);
      } finally {
        env.isProduction = originalProd;
        env.smtpHost = originalHost;
        env.emailFrom = originalFrom;
      }
    });

    test('production email delivery fails when EMAIL_FROM is missing', async () => {
      const originalProd = env.isProduction;
      const originalHost = env.smtpHost;
      const originalFrom = env.emailFrom;

      try {
        env.isProduction = true;
        env.smtpHost = 'smtp.example.com';
        env.emailFrom = undefined;

        await expect(
          emailService.send({
            to: 'test@example.com',
            template: 'WELCOME',
            data: { name: 'Test', dashboardUrl: 'http://localhost/dashboard' },
          })
        ).rejects.toThrow(/missing EMAIL_FROM/i);
      } finally {
        env.isProduction = originalProd;
        env.smtpHost = originalHost;
        env.emailFrom = originalFrom;
      }
    });
  });

  describe('Clean production configuration', () => {
    test('valid production configuration passes validation completely', () => {
      expect(() => validateEnv(validProductionEnv, { exitOnError: false })).not.toThrow();
      expect(validateEnv(validProductionEnv, { exitOnError: false })).toBe(true);
    });
  });
});
