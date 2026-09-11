import dotenv from 'dotenv';

if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else {
  dotenv.config();
}

export class ConfigurationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.errors = errors;
  }
}

export const OBVIOUSLY_INSECURE_JWT_SECRETS = [
  'replace-with-a-long-random-secret-value',
  'your-jwt-secret-here',
  'changeme',
  'secret',
  'token',
  'jwt-secret',
  '',
];

export function validateEnv(rawEnv = process.env, options = { exitOnError: true }) {
  const errors = [];
  const isProd = rawEnv.NODE_ENV === 'production';

  // 1. Required database URL
  if (!rawEnv.DATABASE_URL || !rawEnv.DATABASE_URL.trim()) {
    errors.push('Missing required environment variable: DATABASE_URL');
  } else if (isProd) {
    const looksLikeExampleDbUrl = /generate_a_long_random|change_me|replace_with|user:password@host/i.test(rawEnv.DATABASE_URL);
    if (looksLikeExampleDbUrl) {
      errors.push('DATABASE_URL contains an unconfigured placeholder. Production requires real database credentials.');
    }
  }

  // 2. Required JWT secret
  const jwtSecret = rawEnv.JWT_SECRET;
  const looksLikeExampleJwtSecret = /change_me|generate_a_long_random|example/i.test(jwtSecret || '');
  const isJwtEmptyOrWhitespace = !jwtSecret || jwtSecret.trim().length === 0;
  const isJwtTooShort = jwtSecret && jwtSecret.trim().length < 32;

  if (isJwtEmptyOrWhitespace) {
    errors.push('Missing required environment variable: JWT_SECRET');
  } else if (
    OBVIOUSLY_INSECURE_JWT_SECRETS.includes(jwtSecret) ||
    looksLikeExampleJwtSecret ||
    isJwtTooShort
  ) {
    if (isProd) {
      errors.push('JWT_SECRET is empty, too short (min 32 chars), or is an insecure placeholder. Production requires a strong, random secret.');
    } else if (options.exitOnError) {
      // eslint-disable-next-line no-console
      console.warn('[config] Development mode: Allowing insecure JWT_SECRET for development only. DO NOT USE IN PRODUCTION.');
    }
  }

  // 3. Storage Provider validation
  const configuredStorageProvider = (rawEnv.STORAGE_PROVIDER || 'LOCAL').toUpperCase();
  if (!['LOCAL', 'S3'].includes(configuredStorageProvider)) {
    errors.push(`STORAGE_PROVIDER must be LOCAL or S3, received: ${configuredStorageProvider}`);
  } else if (isProd && configuredStorageProvider !== 'S3') {
    errors.push('Production deployments must use STORAGE_PROVIDER=S3 for durable object storage.');
  }

  // When S3 is active (mandatory in prod, optional in dev)
  if (configuredStorageProvider === 'S3') {
    const s3Required = [
      ['STORAGE_BUCKET', rawEnv.STORAGE_BUCKET],
      ['STORAGE_ACCESS_KEY_ID', rawEnv.STORAGE_ACCESS_KEY_ID],
      ['STORAGE_SECRET_ACCESS_KEY', rawEnv.STORAGE_SECRET_ACCESS_KEY],
    ];

    for (const [name, val] of s3Required) {
      if (!val || !val.trim()) {
        errors.push(`S3 storage provider requires ${name} to be configured`);
      } else if (isProd && /your[-_]|change[-_]me|example|generate/i.test(val)) {
        errors.push(`S3 storage ${name} contains an unconfigured placeholder in production`);
      }
    }
  }

  // 4. Email (SMTP) Configuration validation in Production
  if (isProd) {
    if (!rawEnv.SMTP_HOST || !rawEnv.SMTP_HOST.trim()) {
      errors.push('Production deployments require SMTP_HOST configuration for email delivery.');
    }
    if (!rawEnv.EMAIL_FROM || !rawEnv.EMAIL_FROM.trim()) {
      errors.push('Production deployments require EMAIL_FROM configuration for email delivery.');
    }

    const hasUser = Boolean(rawEnv.SMTP_USER && rawEnv.SMTP_USER.trim());
    const hasPass = Boolean(rawEnv.SMTP_PASS && rawEnv.SMTP_PASS.trim());
    if ((hasUser && !hasPass) || (!hasUser && hasPass)) {
      errors.push('SMTP configuration error: Both SMTP_USER and SMTP_PASS must be provided together if SMTP authentication is enabled.');
    }
  }

  if (errors.length > 0) {
    if (options.exitOnError) {
      for (const err of errors) {
        // eslint-disable-next-line no-console
        console.error(`[config] ${err}`);
      }
      process.exit(1);
    } else {
      throw new ConfigurationError(`Environment configuration validation failed: ${errors.join('; ')}`, errors);
    }
  }

  return true;
}

// Validate process.env upon module initialization
validateEnv(process.env, { exitOnError: true });

const configuredStorageProvider = (process.env.STORAGE_PROVIDER || 'LOCAL').toUpperCase();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  // A comma-separated allow-list is useful for production deployments that
  // have separate application and marketing subdomains.  CLIENT_URL remains
  // the backwards-compatible single-origin configuration.
  allowedOrigins: [...new Set((process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean))],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  storageProvider: configuredStorageProvider,
  storageBucket: process.env.STORAGE_BUCKET,
  storageRegion: process.env.STORAGE_REGION || 'auto',
  storageEndpoint: process.env.STORAGE_ENDPOINT,
  storageAccessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
  storageSecretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  runWorker: process.env.RUN_WORKER !== 'false',

  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,
};
