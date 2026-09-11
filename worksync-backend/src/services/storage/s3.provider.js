import crypto from 'crypto';
import { Readable } from 'stream';
import path from 'path';
import { env } from '../../config/env.js';

/**
 * S3-compatible object storage provider implemented with Node's built-in fetch
 * and AWS Signature V4. This keeps WorkSync compatible with AWS S3, Cloudflare
 * R2 and other S3-compatible providers without coupling the application to a
 * vendor SDK.
 */
export class S3StorageProvider {
  constructor() {
    this.bucket = env.storageBucket;
    this.region = env.storageRegion;
    this.accessKeyId = env.storageAccessKeyId;
    this.secretAccessKey = env.storageSecretAccessKey;
    this.endpoint = env.storageEndpoint || `https://s3.${this.region}.amazonaws.com`;

    if (!this.bucket || !this.region || !this.accessKeyId || !this.secretAccessKey) {
      throw new Error('S3 storage requires STORAGE_BUCKET, STORAGE_REGION, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY');
    }

    if (!this.endpoint.startsWith('http://') && !this.endpoint.startsWith('https://')) {
      throw new Error('STORAGE_ENDPOINT must be an absolute http(s) URL');
    }
  }

  _generateStorageKey(originalName) {
    const ext = path.extname(originalName || '').toLowerCase();
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `attachments/${timestamp}-${random}${ext}`;
  }

  _encodePathSegment(segment) {
    return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  _objectUrl(storageKey) {
    const encodedKey = storageKey.split('/').map((part) => this._encodePathSegment(part)).join('/');
    return `${this.endpoint.replace(/\/$/, '')}/${this._encodePathSegment(this.bucket)}/${encodedKey}`;
  }

  _hash(payload) {
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  _hmac(key, value) {
    return crypto.createHmac('sha256', key).update(value).digest();
  }

  _signKey(dateStamp) {
    const kDate = this._hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = this._hmac(kDate, this.region);
    const kService = this._hmac(kRegion, 's3');
    return this._hmac(kService, 'aws4_request');
  }

  _signedRequest(method, storageKey, body = null, contentType = 'application/octet-stream') {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = body === null ? this._hash('') : this._hash(body);
    const url = new globalThis.URL(this._objectUrl(storageKey));
    const host = url.host;
    const canonicalUri = url.pathname;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this._hash(canonicalRequest),
    ].join('\n');
    const signature = crypto.createHmac('sha256', this._signKey(dateStamp)).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
      Host: host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    };
    if (method === 'PUT') headers['Content-Type'] = contentType;

    return { url: url.toString(), headers };
  }

  async _request(method, storageKey, body = null, contentType) {
    const request = this._signedRequest(method, storageKey, body, contentType);
    let response;
    try {
      response = await globalThis.fetch(request.url, {
        method,
        headers: request.headers,
        body,
      });
    } catch (error) {
      throw new Error(`Object storage request failed: ${error.message}`);
    }

    if (!response.ok) {
      let details = '';
      try {
        details = await response.text();
      } catch {
        // Ignore response-body parsing failures.
      }
      throw new Error(`Object storage ${method} failed (${response.status}): ${details.slice(0, 500)}`);
    }
    return response;
  }

  async upload(fileBuffer, originalName, { contentType = 'application/octet-stream' } = {}) {
    const storageKey = this._generateStorageKey(originalName);
    await this._request('PUT', storageKey, fileBuffer, contentType);
    return {
      storageKey,
      storageProvider: 'S3',
    };
  }

  async getStream(storageKey) {
    const response = await this._request('GET', storageKey);
    if (!response.body) throw new Error('Object storage returned an empty response body');
    return Readable.fromWeb(response.body);
  }

  async getBuffer(storageKey) {
    const response = await this._request('GET', storageKey);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(storageKey) {
    try {
      await this._request('DELETE', storageKey);
      return true;
    } catch {
      return false;
    }
  }

  async exists(storageKey) {
    try {
      await this._request('HEAD', storageKey);
      return true;
    } catch {
      return false;
    }
  }
}
