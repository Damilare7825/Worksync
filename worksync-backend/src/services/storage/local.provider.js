import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env.js';

export class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.uploadDir);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generates a safe, non-colliding storage key.
   */
  _generateStorageKey(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  /**
   * Resolves a key to a safe absolute file path and verifies against path traversal.
   */
  _resolvePath(storageKey) {
    const safeKey = path.basename(storageKey);
    const targetPath = path.resolve(this.uploadDir, safeKey);
    if (!targetPath.startsWith(this.uploadDir)) {
      throw new Error('Path traversal attempt detected');
    }
    return targetPath;
  }

  /**
   * Saves buffer/file to disk.
   */
  async upload(fileBuffer, originalName) {
    const storageKey = this._generateStorageKey(originalName);
    const targetPath = this._resolvePath(storageKey);
    await fs.promises.writeFile(targetPath, fileBuffer);
    return {
      storageKey,
      storageProvider: 'LOCAL',
    };
  }

  /**
   * Returns a readable stream for a file.
   */
  async getStream(storageKey) {
    const targetPath = this._resolvePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found on storage provider');
    }
    return fs.createReadStream(targetPath);
  }

  /**
   * Returns file buffer.
   */
  async getBuffer(storageKey) {
    const targetPath = this._resolvePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found on storage provider');
    }
    return fs.promises.readFile(targetPath);
  }

  /**
   * Deletes file from storage if present.
   */
  async delete(storageKey) {
    try {
      const targetPath = this._resolvePath(storageKey);
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks existence.
   */
  async exists(storageKey) {
    try {
      const targetPath = this._resolvePath(storageKey);
      return fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }
}
