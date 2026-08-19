import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isAdminUser, isOwnerUsername } from "./owner";
import { isOwnerById } from "../middleware/roles";

export function getActiveBan(userId: string) {
  if (isOwnerById(userId)) return null;
  const now = Date.now();
  const rows = db
    .select()
    .from(schema.blocks)
    .where(eq(schema.blocks.blockedId, userId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const row of rows) {
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= now) {
      continue;
    }
    const actor = row.createdBy
      ? db.select().from(schema.users).where(eq(schema.users.id, row.createdBy)).get()
      : null;
    const byStaff = actor ? isAdminUser(actor) : false;
    if (row.source === "blacklist" || byStaff) {
      let files: string[] = [];
      try {
        files = row.filesJson ? JSON.parse(row.filesJson) : [];
      } catch {
        files = [];
      }
      return {
        reason: row.reason || "Нарушение правил платформы",
        details: row.details || "",
        evidence: files,
        actorUsername: actor?.username || "staff",
        actorRole: actor ? (isOwnerUsername(actor.username) ? "owner" : "admin") : "admin",
        createdAt: row.createdAt,
        expiresAt: row.expiresAt || null,
      };
    }
  }
  return null;
}

export function blockedResponsePayload(ban: ReturnType<typeof getActiveBan>) {
  if (!ban) return null;
  const evidencePart = ban.evidence.length ? ` Доказательства: ${ban.evidence.join(", ")}` : "";
  const detailsPart = ban.details ? ` Описание: ${ban.details}.` : "";
  const expiresPart = ban.expiresAt ? ` Срок: до ${new Date(ban.expiresAt).toLocaleString("ru-RU")}.` : " Срок: перманентно.";
  return {
    error: `Вы были заблокированы ${ban.actorRole === "owner" ? "Владельцем" : "Админом"}. Причина: ${ban.reason}.${detailsPart}${expiresPart}${evidencePart}`,
    block: {
      reason: ban.reason,
      details: ban.details,
      evidence: ban.evidence,
      by: ban.actorUsername,
      byRole: ban.actorRole,
      createdAt: ban.createdAt,
      expiresAt: ban.expiresAt,
    },
  };
}
