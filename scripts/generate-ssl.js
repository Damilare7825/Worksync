import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../deploy/nginx/ssl/live');
fs.mkdirSync(targetDir, { recursive: true });

const certPath = path.join(targetDir, 'fullchain.pem');
const keyPath = path.join(targetDir, 'privkey.pem');

console.log(`[ssl-generator] Target directory: ${targetDir}`);

try {
  // Check if openssl is available
  execSync(
    `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "/CN=localhost/O=WorkSync/C=US"`,
    { stdio: 'inherit' }
  );
  console.log('[ssl-generator] Successfully generated self-signed SSL certificates:');
  console.log(`  - Certificate: ${certPath}`);
  console.log(`  - Key: ${keyPath}`);
} catch (_err) {
  console.log('[ssl-generator] OpenSSL not found or failed in shell. Creating fallback mock certificate pair.');
  fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nMIIC...MockCertForLocalTesting...\n-----END CERTIFICATE-----\n');
  fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\nMIIE...MockKeyForLocalTesting...\n-----END PRIVATE KEY-----\n');
  console.log('[ssl-generator] Fallback placeholder certificates written.');
}
