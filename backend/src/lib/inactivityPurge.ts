import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isAdminUser } from "./owner";

const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVITY_DAYS = 60;
export const INACTIVITY_MS = INACTIVITY_DAYS * DAY_MS;

function asMs(v: Date | number | null | undefined): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return n < 1e12 ? n * 1000 : n;
}

function latestReelAt(userId: string): number {
  const row = db
    .select({ createdAt: schema.publications.createdAt })
    .from(schema.publications)
    .where(and(eq(schema.publications.userId, userId), eq(schema.publications.kind, "post")))
    .orderBy(desc(schema.publications.createdAt))
    .limit(1)
    .get();
  return asMs(row?.createdAt);
}

function latestWorkAt(userId: string): number {
  const row = db
    .select({ createdAt: schema.builds.createdAt })
    .from(schema.builds)
    .where(eq(schema.builds.userId, userId))
    .orderBy(desc(schema.builds.createdAt))
    .limit(1)
    .get();
  return asMs(row?.createdAt);
}

export type InactivityPurgeResult = {
  checked: number;
  deleted: string[];
  dryRun: boolean;
};

/**
 * Single pass: delete inactive blogger/seller accounts.
 * - blogger: no new reel (publication kind=post) for 60 days (from register if never posted)
 * - seller: no new work AND no new reel for 60 days (both must be stale)
 * Clients and admins are never purged here.
 */
export function purgeInactivePlatformAccounts(opts?: { dryRun?: boolean; now?: number }): InactivityPurgeResult {
  const dryRun = Boolean(opts?.dryRun ?? process.env.INACTIVITY_PURGE_DRY_RUN === "1");
  const now = opts?.now ?? Date.now();
  const cutoff = now - INACTIVITY_MS;
  const deleted: string[] = [];

  const candidates = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      roleFlags: schema.users.roleFlags,
      platformRole: schema.users.platformRole,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .all()
    .filter((u) => u.platformRole === "blogger" || u.platformRole === "seller");

  for (const u of candidates) {
    if (isAdminUser(u)) continue;

    const registeredAt = asMs(u.createdAt) || now;
    if (registeredAt > cutoff) continue; // grace: account younger than 60 days

    let stale = false;
    if (u.platformRole === "blogger") {
      const lastReel = latestReelAt(u.id) || registeredAt;
      stale = lastReel <= cutoff;
    } else if (u.platformRole === "seller") {
      const lastReel = latestReelAt(u.id) || registeredAt;
      const lastWork = latestWorkAt(u.id) || registeredAt;
      // both conditions required: no new work AND no new reel
      stale = lastWork <= cutoff && lastReel <= cutoff;
    }

    if (!stale) continue;
    deleted.push(u.username);
    if (!dryRun) {
      db.delete(schema.users).where(eq(schema.users.id, u.id)).run();
    }
  }

  return { checked: candidates.length, deleted, dryRun };
}
