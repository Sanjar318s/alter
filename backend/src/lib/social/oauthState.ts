import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../../db";

const PREFIX = "oauth_state:";
const TTL_MS = 10 * 60 * 1000;

function key(state: string) {
  return `${PREFIX}${state}`;
}

export function createOAuthState(provider: string, userId: string) {
  const state = uuid();
  db.insert(schema.appKv)
    .values({
      key: key(state),
      value: JSON.stringify({ provider, userId, exp: Date.now() + TTL_MS }),
      updatedAt: new Date(),
    })
    .run();
  return state;
}

/** Returns userId when state is valid; deletes the state (one-time use). */
export function consumeOAuthState(state: string, provider: string): string | null {
  if (!state) return null;
  const row = db.select().from(schema.appKv).where(eq(schema.appKv.key, key(state))).get();
  if (!row) return null;
  db.delete(schema.appKv).where(eq(schema.appKv.key, key(state))).run();
  try {
    const parsed = JSON.parse(row.value) as { provider?: string; userId?: string; exp?: number };
    if (parsed.provider !== provider) return null;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}
