import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { getActiveBan } from "./blocking";
import { getOwnerUser, isAdminUser, isOwnerById } from "./owner";
import { logAuditEvent } from "./audit";
import { postBlacklistChannelCard } from "./blacklistChannel";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function asTime(v: Date | number | null | undefined) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return n < 1e12 ? n * 1000 : n;
}

function findModeratorActorId() {
  const owner = getOwnerUser();
  if (owner) return owner.id;
  const users = db.select().from(schema.users).all();
  const admin = users.find((u) => isAdminUser(u));
  return admin?.id || null;
}

export function evaluateAndAutoBan(userId: string, trigger: "report" | "profanity") {
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return { applied: false as const, reason: "user_not_found" as const };
  if (isAdminUser(user)) return { applied: false as const, reason: "staff_user" as const };
  if (isOwnerById(user.id)) return { applied: false as const, reason: "owner_user" as const };
  if (getActiveBan(userId)) return { applied: false as const, reason: "already_blocked" as const };

  const since = Date.now() - WINDOW_MS;
  const reports24h = db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.targetId, userId))
    .all()
    .filter((r) => asTime(r.createdAt) >= since).length;
  const profanity24h = db
    .select()
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.actorId, userId), eq(schema.auditEvents.type, "profanity_detected")))
    .all()
    .filter((e) => asTime(e.createdAt) >= since).length;

  const score = reports24h * 2 + profanity24h;
  const shouldBan = reports24h >= 3 || profanity24h >= 5 || score >= 7;
  if (!shouldBan) {
    return { applied: false as const, reason: "threshold_not_met" as const, reports24h, profanity24h, score };
  }

  const actorId = findModeratorActorId();
  if (!actorId) return { applied: false as const, reason: "no_moderator_actor" as const };

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const existing = db
    .select()
    .from(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, actorId), eq(schema.blocks.blockedId, userId)))
    .get();

  if (existing) {
    db.update(schema.blocks)
      .set({
        reason: "Автомодерация: высокий риск нарушений",
        details: `trigger=${trigger}; reports24h=${reports24h}; profanity24h=${profanity24h}; score=${score}`,
        source: "blacklist",
        createdBy: actorId,
        expiresAt,
      })
      .where(and(eq(schema.blocks.blockerId, actorId), eq(schema.blocks.blockedId, userId)))
      .run();
  } else {
    db.insert(schema.blocks)
      .values({
        blockerId: actorId,
        blockedId: userId,
        reason: "Автомодерация: высокий риск нарушений",
        details: `trigger=${trigger}; reports24h=${reports24h}; profanity24h=${profanity24h}; score=${score}`,
        source: "blacklist",
        createdBy: actorId,
        expiresAt,
      })
      .run();
  }

  logAuditEvent({
    type: "auto_temp_ban_applied",
    actorId,
    targetType: "user",
    targetId: userId,
    severity: "high",
    payload: {
      trigger,
      reports24h,
      profanity24h,
      score,
      expiresAt: expiresAt.toISOString(),
    },
  });

  postBlacklistChannelCard({
    actorId,
    blockedUserId: userId,
    reason: "Автомодерация: высокий риск нарушений",
    details: `trigger=${trigger}; reports24h=${reports24h}; profanity24h=${profanity24h}; score=${score}`,
    expiresAt,
    source: "auto",
  });

  return { applied: true as const, reports24h, profanity24h, score, expiresAt };
}
