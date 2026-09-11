import { env } from '../config/env.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'proxyauthorization',
  'cookie',
  'cookies',
  'setcookie',
  'jwt',
  'secret',
  'apikey',
  'databaseurl',
  'smtppassword',
  'smtppass',
  'pass',
  'invitationtoken',
  'resettoken',
  'creditcard',
]);

export function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForLogging);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const normalizedKey = lowerKey.replace(/[^a-z0-9]/g, '');
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      SENSITIVE_KEYS.has(normalizedKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      normalizedKey.includes('secret') ||
      normalizedKey.includes('token') ||
      normalizedKey.includes('password') ||
      normalizedKey.includes('apikey') ||
      normalizedKey.includes('databaseurl') ||
      normalizedKey.includes('authorization') ||
      normalizedKey.includes('cookie') ||
      normalizedKey === 'pass' ||
      normalizedKey.endsWith('pass')
    ) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeForLogging(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const currentLogLevel = env.isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

function formatLog(level, message, meta = {}) {
  const sanitizedMeta = sanitizeForLogging(meta);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedMeta,
  };
  return JSON.stringify(logEntry);
}

export const logger = {
  debug(message, meta) {
    if (LOG_LEVELS.DEBUG >= currentLogLevel && !env.isTest) {
      // eslint-disable-next-line no-console
      console.log(formatLog('DEBUG', message, meta));
    }
  },

  info(message, meta) {
    if (LOG_LEVELS.INFO >= currentLogLevel && !env.isTest) {
      // eslint-disable-next-line no-console
      console.log(formatLog('INFO', message, meta));
    }
  },

  warn(message, meta) {
    if (LOG_LEVELS.WARN >= currentLogLevel && !env.isTest) {
      // eslint-disable-next-line no-console
      console.warn(formatLog('WARN', message, meta));
    }
  },

  error(message, meta) {
    if (LOG_LEVELS.ERROR >= currentLogLevel && !env.isTest) {
      // eslint-disable-next-line no-console
      console.error(formatLog('ERROR', message, meta));
    }
  },
};
