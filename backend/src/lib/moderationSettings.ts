import { eq } from "drizzle-orm";
import { db, schema } from "../db";

const DEFAULTS = {
  id: "global",
  autoEscalateEnabled: true,
  autoEscalateIntervalMs: 300000,
  escalationCooldownMs: 21600000,
};

export function getModerationSettings() {
  let row = db.select().from(schema.moderationSettings).where(eq(schema.moderationSettings.id, "global")).get();
  if (!row) {
    db.insert(schema.moderationSettings).values(DEFAULTS).run();
    row = db.select().from(schema.moderationSettings).where(eq(schema.moderationSettings.id, "global")).get()!;
  }
  return {
    autoEscalateEnabled: Boolean(row.autoEscalateEnabled),
    autoEscalateIntervalMs: Math.max(60_000, Number(row.autoEscalateIntervalMs || DEFAULTS.autoEscalateIntervalMs)),
    escalationCooldownMs: Math.max(60_000, Number(row.escalationCooldownMs || DEFAULTS.escalationCooldownMs)),
    updatedBy: row.updatedBy || null,
    updatedAt: row.updatedAt,
  };
}

export function updateModerationSettings(
  patch: Partial<{ autoEscalateEnabled: boolean; autoEscalateIntervalMs: number; escalationCooldownMs: number }>,
  actorId?: string
) {
  const current = getModerationSettings();
  const next = {
    autoEscalateEnabled: patch.autoEscalateEnabled ?? current.autoEscalateEnabled,
    autoEscalateIntervalMs: Math.max(60_000, Number(patch.autoEscalateIntervalMs ?? current.autoEscalateIntervalMs)),
    escalationCooldownMs: Math.max(60_000, Number(patch.escalationCooldownMs ?? current.escalationCooldownMs)),
    updatedBy: actorId || null,
    updatedAt: new Date(),
  };
  db.update(schema.moderationSettings).set(next).where(eq(schema.moderationSettings.id, "global")).run();
  return getModerationSettings();
}
