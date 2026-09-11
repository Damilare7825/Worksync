import { LocalStorageProvider } from './local.provider.js';
import { S3StorageProvider } from './s3.provider.js';
import { env } from '../../config/env.js';

class StorageService {
  constructor() {
    this.provider = env.storageProvider === 'S3'
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  }

  async upload(fileBuffer, originalName, options) {
    return this.provider.upload(fileBuffer, originalName, options);
  }

  async getStream(storageKey) {
    return this.provider.getStream(storageKey);
  }

  async getBuffer(storageKey) {
    return this.provider.getBuffer(storageKey);
  }

  async delete(storageKey) {
    return this.provider.delete(storageKey);
  }

  async exists(storageKey) {
    return this.provider.exists(storageKey);
  }
}

export const storageService = new StorageService();
