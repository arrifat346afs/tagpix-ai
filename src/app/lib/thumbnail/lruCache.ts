/**
 * Bounded LRU cache shared by every thumbnail pipeline (Rust-backed and
 * browser canvas-backed).
 */

/**
 * Simple LRU cache backed by a plain `Map` (which preserves insertion order).
 * On every `get` the entry is moved to the end (most-recently-used position).
 * When `capacity` is reached the oldest entry (front of the Map) is evicted.
 */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly map: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    // Refresh: delete-then-reinsert marks the entry as most-recently used.
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict the oldest entry (first key in insertion order).
      const firstKey = this.map.keys().next().value as K;
      this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}

export const THUMBNAIL_CACHE_CAPACITY = 2000;

/**
 * Stores `asset://` URLs (or null for failures).  Values are short strings
 * (~80 bytes each) so even the full 2 000-entry cap uses < 200 KB.
 * Canvas-generated fallback data-URLs are also stored here; they are larger
 * but the LRU eviction keeps total size bounded.
 */
export const thumbnailCache = new LRUCache<string, string | null>(THUMBNAIL_CACHE_CAPACITY);
