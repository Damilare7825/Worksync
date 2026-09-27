import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseDatabaseUrl, pruneOldBackups, runBackup } from '../../scripts/backup-db.js';
import { runRestore } from '../../scripts/restore-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Phase 26 — Production Infrastructure Test Suite', () => {
  const testBackupsDir = path.resolve(__dirname, 'scratch/backups');

  beforeAll(() => {
    fs.mkdirSync(testBackupsDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testBackupsDir)) {
      fs.rmSync(testBackupsDir, { recursive: true, force: true });
    }
  });

  describe('Nginx Reverse Proxy & TLS Configuration', () => {
    test('default.conf exists and defines both HTTP redirect and HTTPS TLS blocks', () => {
      const configPath = path.join(rootDir, 'deploy/nginx/default.conf');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');

      // HTTP block with redirect & ACME challenge
      expect(content).toMatch(/listen\s+80/);
      expect(content).toMatch(/return\s+301\s+https:\/\/\$host\$request_uri;/);
      expect(content).toMatch(/\.well-known\/acme-challenge/);

      // HTTPS block
      expect(content).toMatch(/listen\s+443\s+ssl\s+http2/);
      expect(content).toMatch(/ssl_protocols\s+TLSv1\.2\s+TLSv1\.3;/);
      expect(content).toMatch(/Strict-Transport-Security/);
      expect(content).toMatch(/ssl_certificate\s+\/etc\/nginx\/ssl\/live\/fullchain\.pem;/);
      expect(content).toMatch(/ssl_certificate_key\s+\/etc\/nginx\/ssl\/live\/privkey\.pem;/);

      // Security headers
      expect(content).toMatch(/X-Frame-Options\s+DENY/);
      expect(content).toMatch(/X-Content-Type-Options\s+nosniff/);
      expect(content).toMatch(/Referrer-Policy\s+strict-origin-when-cross-origin/);

      // Upstream route proxying
      expect(content).toMatch(/proxy_pass\s+http:\/\/api:5000;/);
      expect(content).toMatch(/proxy_pass\s+http:\/\/frontend:80;/);
      expect(content).toMatch(/proxy_pass\s+http:\/\/api:5000\/socket\.io\/;/);
      expect(content).toMatch(/X-Forwarded-Proto\s+https;/);
      expect(content).toMatch(/X-Forwarded-Port\s+443;/);
    });

    test('http-fallback.conf exists for non-SSL environments', () => {
      const fallbackPath = path.join(rootDir, 'deploy/nginx/http-fallback.conf');
      expect(fs.existsSync(fallbackPath)).toBe(true);
      const content = fs.readFileSync(fallbackPath, 'utf-8');
      expect(content).toMatch(/listen\s+80/);
      expect(content).toMatch(/proxy_pass\s+http:\/\/api:5000;/);
    });
  });

  describe('Docker Compose Production Topology', () => {
    test('docker-compose.production.yml defines all production services with restart policies and healthchecks', () => {
      const composePath = path.join(rootDir, 'docker-compose.production.yml');
      expect(fs.existsSync(composePath)).toBe(true);

      const content = fs.readFileSync(composePath, 'utf-8');

      // Core production services
      expect(content).toMatch(/postgres:/);
      expect(content).toMatch(/api:/);
      expect(content).toMatch(/worker:/);
      expect(content).toMatch(/frontend:/);
      expect(content).toMatch(/nginx:/);
      expect(content).toMatch(/db-backup:/);

      // Port bindings & SSL mounts
      expect(content).toMatch(/"80:80"/);
      expect(content).toMatch(/"443:443"/);
      expect(content).toMatch(/\.\/deploy\/nginx\/ssl:\/etc\/nginx\/ssl:ro/);

      // Healthcheck & restart policies
      expect(content).toMatch(/restart:\s*unless-stopped/);
      expect(content).toMatch(/condition:\s*service_healthy/);
      expect(content).toMatch(/pg_isready/);

      // Volumes
      expect(content).toMatch(/postgres_data:/);
      expect(content).toMatch(/uploads_data:/);
      expect(content).toMatch(/backup_data:/);
    });
  });

  describe('Database Backup & Disaster Recovery Automation', () => {
    test('parseDatabaseUrl parses valid connection strings and handles fallbacks', () => {
      const parsed = parseDatabaseUrl('postgresql://prod_user:secret_pass@db.internal:5433/worksync_prod?sslmode=require');
      expect(parsed).toEqual({
        user: 'prod_user',
        password: 'secret_pass',
        host: 'db.internal',
        port: '5433',
        database: 'worksync_prod',
      });

      expect(parseDatabaseUrl(null)).toBeNull();
      expect(parseDatabaseUrl('invalid-url')).toBeNull();
    });

    test('runBackup creates a timestamped dump file with metadata', async () => {
      const result = await runBackup({
        backupDir: testBackupsDir,
        retentionDays: 7,
        mockDump: true,
      });

      expect(result.success).toBe(true);
      expect(result.file).toMatch(/^worksync_backup_\d{4}-\d{2}-\d{2}_\d{6}\.dump$/);
      expect(fs.existsSync(result.path)).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    test('pruneOldBackups removes dump files exceeding retention threshold', () => {
      const oldFile = path.join(testBackupsDir, 'worksync_backup_2020-01-01_000000.dump');
      fs.writeFileSync(oldFile, 'OLD_SNAPSHOT_CONTENT');

      // Set mtime to 30 days ago
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      fs.utimesSync(oldFile, new Date(thirtyDaysAgo), new Date(thirtyDaysAgo));

      const pruned = pruneOldBackups(testBackupsDir, 14);
      expect(pruned).toContain('worksync_backup_2020-01-01_000000.dump');
      expect(fs.existsSync(oldFile)).toBe(false);
    });

    test('runRestore verifies file existence and executes mock restore', async () => {
      const validDump = path.join(testBackupsDir, 'valid_test.dump');
      fs.writeFileSync(validDump, 'DUMP_DATA');

      const restoreResult = await runRestore({
        dumpFilePath: validDump,
        mockRestore: true,
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredFrom).toBe(validDump);

      // Rejects nonexistent file
      await expect(
        runRestore({ dumpFilePath: path.join(testBackupsDir, 'nonexistent.dump') })
      ).rejects.toThrow('does not exist');

      // Rejects empty file
      const emptyDump = path.join(testBackupsDir, 'empty.dump');
      fs.writeFileSync(emptyDump, '');
      await expect(
        runRestore({ dumpFilePath: emptyDump })
      ).rejects.toThrow('empty');
    });
  });

  describe('Production Environment & Secret Hygiene', () => {
    test('.env.production.example defines required security and infrastructure parameters', () => {
      const envProdPath = path.join(rootDir, '.env.production.example');
      expect(fs.existsSync(envProdPath)).toBe(true);

      const content = fs.readFileSync(envProdPath, 'utf-8');
      expect(content).toMatch(/DATABASE_URL=/);
      expect(content).toMatch(/JWT_SECRET=/);
      expect(content).toMatch(/CLIENT_URL=/);
      expect(content).toMatch(/CORS_ALLOWED_ORIGINS=/);
      expect(content).toMatch(/STORAGE_PROVIDER=S3/);
    });
  });
});
