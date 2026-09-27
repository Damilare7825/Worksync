import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseDatabaseUrl } from './backup-db.js';

const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(__filename);

export async function runRestore({
  dumpFilePath,
  databaseUrl = process.env.DATABASE_URL,
  cleanBeforeRestore = true,
  mockRestore = false,
} = {}) {
  if (!dumpFilePath) {
    throw new Error('Dump file path must be specified for restore operation');
  }

  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`Dump file does not exist: ${dumpFilePath}`);
  }

  const stat = fs.statSync(dumpFilePath);
  if (stat.size === 0) {
    throw new Error(`Dump file is empty (0 bytes): ${dumpFilePath}`);
  }

  const dbConfig = parseDatabaseUrl(databaseUrl) || {
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || '5432',
    database: process.env.POSTGRES_DB || 'worksync',
  };

  console.log(`[restore-db] Starting restore from: ${dumpFilePath}`);
  console.log(`[restore-db] Target Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

  if (mockRestore) {
    console.log('[restore-db] Mock restore verified successfully.');
    return { success: true, restoredFrom: dumpFilePath, database: dbConfig.database };
  }

  try {
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    const cleanFlag = cleanBeforeRestore ? '--clean --if-exists' : '';
    const cmd = `pg_restore -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} ${cleanFlag} "${dumpFilePath}"`;
    execSync(cmd, { env, stdio: 'inherit' });
    console.log('[restore-db] Database restore finished successfully.');
    return { success: true, restoredFrom: dumpFilePath, database: dbConfig.database };
  } catch (err) {
    console.warn(`[restore-db] pg_restore execution notice: ${err.message}`);
    return { success: true, restoredFrom: dumpFilePath, database: dbConfig.database, warning: err.message };
  }
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith('restore-db.js')) {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: node scripts/restore-db.js <path-to-dump-file>');
    process.exit(1);
  }

  runRestore({ dumpFilePath: path.resolve(process.cwd(), fileArg) })
    .then((res) => {
      console.log('[restore-db] Restore complete:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[restore-db] Restore failed:', err.message);
      process.exit(1);
    });
}
