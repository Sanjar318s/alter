import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { BLACKLIST_CHANNEL_ID, COMMUNITY_ROOMS, conversationIdForRoom } from "./communityRooms";
import { isAdminUser, isOwnerById } from "./owner";
import { realtime } from "../routes/realtime";

export function ensureCommunityRooms() {
  for (const room of COMMUNITY_ROOMS) {
    const convId = conversationIdForRoom(room.id);
    if (!db.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get()) {
      db.insert(schema.conversations).values({ id: convId, type: "channel" }).run();
    }
    if (!db.select().from(schema.channels).where(eq(schema.channels.id, room.id)).get()) {
      db.insert(schema.channels)
        .values({
          id: room.id,
          conversationId: convId,
          kind: room.kind,
          title: room.title,
          writeMode: room.id === BLACKLIST_CHANNEL_ID ? "owner_only" : "members",
          sortOrder: room.order,
          managerIdsJson: "[]",
        })
        .run();
    } else {
      const existing = db.select().from(schema.channels).where(eq(schema.channels.id, room.id)).get();
      if (existing && Number(existing.sortOrder || 0) <= 0) {
        db.update(schema.channels)
          .set({ sortOrder: room.order })
          .where(eq(schema.channels.id, room.id))
          .run();
      }
    }
  }
}

export type BlacklistCardSource = "manual" | "blacklist" | "auto";

export function buildBlacklistCardText(input: {
  blockedUsername?: string | null;
  blockedId: string;
  actorUsername?: string | null;
  actorRole: "owner" | "admin" | "system";
  reason?: string | null;
  details?: string | null;
  files?: string[];
  expiresAt?: Date | null;
  source: BlacklistCardSource;
}) {
  const actionLabel =
    input.source === "blacklist"
      ? "Чёрный список"
      : input.source === "auto"
        ? "Автоблокировка"
        : "Блокировка";

  const actorLabel =
    input.actorRole === "owner"
      ? "Владелец"
      : input.actorRole === "admin"
        ? "Админ"
        : "Система";

  const riskLabel = "высокий";

  let detailsLine = "";
  if (input.details?.trim()) {
    const d = input.details.trim();
    if (d === "manual_admin_block") {
      detailsLine = "Комментарий: блокировка через админ-панель";
    } else if (d.includes("trigger=")) {
      detailsLine = `Комментарий: ${humanizeAutoDetailsForCard(d)}`;
    } else {
      detailsLine = `Комментарий: ${d}`;
    }
  }

  return [
    "🚫 ALTER BLACKLIST CARD",
    `Тип: ${actionLabel}`,
    `Пользователь: @${input.blockedUsername || input.blockedId}`,
    `Причина: ${input.reason || "Не указана"}`,
    `Кем: ${actorLabel}${input.actorUsername ? ` (@${input.actorUsername})` : ""}`,
    `Когда: ${new Date().toLocaleString("ru-RU")}`,
    `Риск: ${riskLabel}`,
    detailsLine,
    input.expiresAt ? `Срок: до ${input.expiresAt.toLocaleString("ru-RU")}` : "Срок: перманентно",
    input.files?.length ? `Доказательства: ${input.files.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function humanizeAutoDetailsForCard(raw: string) {
  const parts = raw.split(";").map((p) => p.trim());
  return parts
    .map((part) => {
      if (part.startsWith("trigger=profanity")) return "автоматически из‑за мата";
      if (part.startsWith("trigger=reports")) return "автоматически из‑за жалоб";
      if (part.startsWith("reports24h=")) return `жалоб за сутки: ${part.split("=")[1]}`;
      if (part.startsWith("profanity24h=")) return `мат за сутки: ${part.split("=")[1]}`;
      if (part.startsWith("score=")) return `оценка риска: ${part.split("=")[1]}`;
      return part;
    })
    .join(", ");
}

/** Публикует карточку в канал «Чёрный список косплей комьюнити» при модерации staff. */
export function postBlacklistChannelCard(input: {
  actorId: string;
  blockedUserId: string;
  reason?: string | null;
  details?: string | null;
  files?: string[];
  expiresAt?: Date | null;
  source: BlacklistCardSource;
}) {
  const actor = db.select().from(schema.users).where(eq(schema.users.id, input.actorId)).get();
  if (!actor || !isAdminUser(actor)) return null;

  const blocked = db.select().from(schema.users).where(eq(schema.users.id, input.blockedUserId)).get();
  if (blocked && isOwnerById(blocked.id)) return null;
  ensureCommunityRooms();

  const convId = conversationIdForRoom(BLACKLIST_CHANNEL_ID);
  const card = buildBlacklistCardText({
    blockedUsername: blocked?.username,
    blockedId: input.blockedUserId,
    actorUsername: actor.username,
    actorRole: isOwnerById(actor.id) ? "owner" : "admin",
    reason: input.reason,
    details: input.details,
    files: input.files,
    expiresAt: input.expiresAt,
    source: input.source,
  });

  const msgId = uuid();
  db.insert(schema.messages)
    .values({
      id: msgId,
      conversationId: convId,
      senderId: input.actorId,
      type: "text",
      text: card,
      status: "sent",
    })
    .run();

  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, convId))
    .all()
    .map((m) => m.userId);

  const message = db.select().from(schema.messages).where(eq(schema.messages.id, msgId)).get();
  realtime.broadcastToConversation(memberIds, {
    event: "message",
    data: { conversationId: convId, message },
  });

  return msgId;
}
