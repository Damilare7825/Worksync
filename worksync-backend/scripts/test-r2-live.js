import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({
  path: process.env.ENV_FILE || '.env',
});

// Dynamically import the appropriate storage provider based on STORAGE_PROVIDER
let StorageProvider;
if ((process.env.STORAGE_PROVIDER || 'LOCAL').toUpperCase() === 'S3') {
  StorageProvider = (await import('../src/services/storage/s3.provider.js')).S3StorageProvider;
} else {
  StorageProvider = (await import('../src/services/storage/local.provider.js')).LocalStorageProvider;
}

const provider = new StorageProvider();

const originalName = `r2-live-test-${randomUUID()}.txt`;
const content = `WorkSync R2 live test - ${new Date().toISOString()}`;
const buffer = Buffer.from(content, 'utf8');

console.log('Starting WorkSync storage live test...');
console.log(`Provider: ${process.env.STORAGE_PROVIDER || 'LOCAL'}`);
console.log(`Bucket/Directory: ${process.env.STORAGE_BUCKET || process.env.UPLOAD_DIR || './uploads'}`);

let storageKey = null;
let uploaded = false;

try {
  // 1. Upload
  const uploadedObject = await provider.upload(
    buffer,
    originalName,
    { contentType: 'text/plain' }
  );

  storageKey = uploadedObject.storageKey;
  uploaded = true;

  console.log('✓ Upload passed');
  console.log(`Key: ${storageKey}`);

  // 2. Exists
  const existsAfterUpload = await provider.exists(storageKey);

  if (!existsAfterUpload) {
    throw new Error('Object does not exist after upload');
  }

  console.log('✓ Exists check passed');

  // 3. Download/read
  const downloaded = await provider.getBuffer(storageKey);
  const downloadedContent = downloaded.toString('utf8');

  if (downloadedContent !== content) {
    throw new Error('Downloaded content does not match uploaded content');
  }

  console.log('✓ Download and content verification passed');

  // 4. Delete
  const deleted = await provider.delete(storageKey);

  if (!deleted) {
    throw new Error('Delete operation failed');
  }

  uploaded = false;

  console.log('✓ Delete passed');

  // 5. Confirm deletion
  const existsAfterDelete = await provider.exists(storageKey);

  if (existsAfterDelete) {
    throw new Error('Object still exists after delete');
  }

  console.log('✓ Deletion verification passed');

  console.log('\nA3 STORAGE LIVE TEST: PASS');
} catch (error) {
  console.error('\nA3 STORAGE LIVE TEST: FAIL');
  console.error(error);

  process.exitCode = 1;
} finally {
  // Safety cleanup if any earlier step failed.
  if (uploaded && storageKey) {
    try {
      const cleanedUp = await provider.delete(storageKey);

      if (cleanedUp) {
        console.log('✓ Cleanup completed');
      } else {
        console.error('⚠ Cleanup failed: delete returned false');
      }
    } catch (cleanupError) {
      console.error('⚠ Cleanup failed:', cleanupError.message);
    }
  }
}