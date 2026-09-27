/**
 * High-performance in-memory TTL cache utility.
 * Supports get, set, delete, prefix-based invalidation, and wrap (cache-aside).
 * Thread-safe and process-local with low memory overhead.
 */

class MemoryCache {
  constructor({ defaultTtlMs = 60 * 1000, cleanupIntervalMs = 5 * 60 * 1000 } = {}) {
    this.store = new Map();
    this.defaultTtlMs = defaultTtlMs;
    this.hits = 0;
    this.misses = 0;

    // Background cleanup of expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  set(key, value, ttlSeconds) {
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
    return value;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  del(key) {
    return this.store.delete(key);
  }

  delByPrefix(prefix) {
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Cache-aside helper: returns cached value or executes fn(), caches result, and returns it.
   */
  async wrap(key, ttlSeconds, fn) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fn();
    if (fresh !== undefined && fresh !== null) {
      this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
    };
  }
}

export const appCache = new MemoryCache();
export { MemoryCache };
