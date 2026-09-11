import { jest } from '@jest/globals';

const envMock = {
  storageBucket: 'worksync-test',
  storageRegion: 'auto',
  storageEndpoint: 'https://example.r2.cloudflarestorage.com',
  storageAccessKeyId: 'test-access-key',
  storageSecretAccessKey: 'test-secret-key',
};

jest.unstable_mockModule('../src/config/env.js', () => ({ env: envMock }));

const { S3StorageProvider } = await import('../src/services/storage/s3.provider.js');

describe('S3StorageProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  test('uploads with AWS Signature V4 headers and returns an S3 storage key', async () => {
    const provider = new S3StorageProvider();
    const response = new globalThis.Response(null, { status: 200 });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    const result = await provider.upload(Buffer.from('hello'), 'report.pdf', {
      contentType: 'application/pdf',
    });

    expect(result.storageProvider).toBe('S3');
    expect(result.storageKey).toMatch(/^attachments\/\d+-[a-f0-9]{32}\.pdf$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/worksync-test/attachments/');
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(options.headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/);
    expect(options.headers['x-amz-content-sha256']).toHaveLength(64);
    expect(options.headers['Content-Type']).toBe('application/pdf');
  });

  test('exists uses HEAD and returns false for a missing object', async () => {
    const provider = new S3StorageProvider();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new globalThis.Response(null, { status: 404 }));

    await expect(provider.exists('attachments/missing.txt')).resolves.toBe(false);
  });

  test('getBuffer returns the object bytes', async () => {
    const provider = new S3StorageProvider();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new globalThis.Response(Buffer.from('stored-content'), { status: 200 })
    );

    await expect(provider.getBuffer('attachments/file.txt')).resolves.toEqual(
      Buffer.from('stored-content')
    );
  });

  test('delete is non-throwing when object storage rejects the delete', async () => {
    const provider = new S3StorageProvider();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new globalThis.Response(null, { status: 500 }));

    await expect(provider.delete('attachments/file.txt')).resolves.toBe(false);
  });
});
