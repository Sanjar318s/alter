/** Short in-memory cache for anonymous public GETs (free, process-local). */
type Entry = { at: number; body: unknown };

const store = new Map<string, Entry>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.body as T;
}

export function setCached(key: string, body: unknown, maxEntries = 200) {
  if (store.size >= maxEntries) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { at: Date.now(), body });
}

export function publicCacheHeaders(res: import("express").Response, maxAgeSec = 45) {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 3}`
  );
}
