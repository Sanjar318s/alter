import { v4 as uuid } from "uuid";
import { db, schema } from "../db";

type AuditEventInput = {
  type: string;
  actorId?: string | null;
  targetType: "user" | "message" | "order" | "channel" | "staff" | "report" | "withdrawal" | "partner" | "campaign" | "placement";
  targetId: string;
  severity?: "info" | "warn" | "high";
  payload?: unknown;
};

export function logAuditEvent(input: AuditEventInput) {
  db.insert(schema.auditEvents)
    .values({
      id: uuid(),
      type: input.type,
      actorId: input.actorId || null,
      targetType: input.targetType,
      targetId: input.targetId,
      severity: input.severity || "info",
      payloadJson: input.payload == null ? null : JSON.stringify(input.payload),
    })
    .run();
}

const STOP_WORDS = [
  "сука",
  "бляд",
  "хуй",
  "пизд",
  "еба",
  "нахер",
  "урод",
];

export function detectProfanity(text?: string | null) {
  if (!text) return [];
  const normalized = text.toLowerCase();
  return STOP_WORDS.filter((w) => normalized.includes(w));
}
