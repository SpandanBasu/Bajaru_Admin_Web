/**
 * Lightweight localStorage cache for React Query.
 *
 * Stores serialized query data under a namespaced key alongside a `savedAt`
 * timestamp. React Query's `initialData` + `initialDataUpdatedAt` options use
 * this to decide whether the cached value is still within `staleTime`:
 *   - savedAt is recent  → data is fresh → no network call at all
 *   - savedAt is old     → data shown immediately, background refetch starts
 *   - no entry           → normal first-load fetch
 *
 * Usage:
 *   const cache = makeLocalCache<MyType[]>("my-key");
 *
 *   useQuery({
 *     queryKey: ["my-key"],
 *     queryFn: async () => { const d = await fetchData(); cache.write(d); return d; },
 *     initialData: cache.read() ?? undefined,
 *     initialDataUpdatedAt: cache.savedAt() ?? undefined,
 *     staleTime: CACHE_TTL,
 *   });
 */

const NS = "bj_qc_"; // namespace prefix so keys don't collide with other localStorage usage

interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

export const CACHE_TTL_15M = 15 * 60 * 1000;
export const CACHE_TTL_1H  = 60 * 60 * 1000;
export const CACHE_TTL_1D  = 24 * 60 * 60 * 1000;

export function makeLocalCache<T>(key: string, ttl = CACHE_TTL_15M) {
  const storageKey = NS + key;

  function read(): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      // Evict if the entry is older than the TTL
      if (Date.now() - entry.savedAt > ttl) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  function savedAt(): number | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      return entry.savedAt;
    } catch {
      return null;
    }
  }

  function write(data: T): void {
    try {
      const entry: CacheEntry<T> = { data, savedAt: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
      // Ignore quota errors — cache is best-effort
    }
  }

  function clear(): void {
    localStorage.removeItem(storageKey);
  }

  return { read, write, savedAt, clear };
}
