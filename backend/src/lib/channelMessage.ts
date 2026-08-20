import { v4 as uuid } from "uuid";
import { eq, and, ne } from "drizzle-orm";
import { db, schema } from "../db";
import { ensureCommunityRooms } from "./blacklistChannel";
import { notify } from "./notify";
import { realtime } from "../routes/realtime";
import { isOwnerUsername, ADMIN_USERNAME } from "./owner";

function enrichSender(userId: string) {
  const sender = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!sender) return null;
  const senderProfile = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, sender.id))
    .get();
  return {
    username: sender.username,
    staffRole: senderProfile?.staffRole || (isOwnerUsername(sender.username) ? "owner" : "none"),
    staffBadgeHidden: Boolean(senderProfile?.staffBadgeHidden),
    avatarUrl: senderProfile?.avatarUrl || null,
  };
}

function enrichMessage(m: typeof schema.messages.$inferSelect) {
  let reactions: Record<string, string[]> = {};
  try {
    reactions = m.reactionsJson ? JSON.parse(m.reactionsJson) : {};
  } catch {
    reactions = {};
  }
  return {
    ...m,
    text: m.deleted ? null : m.text,
    mediaUrl: m.deleted ? null : m.mediaUrl,
    deleted: Boolean(m.deleted),
    reactions,
    sender: enrichSender(m.senderId),
  };
}

const TELEGRAM_PUBLISHER_USERNAME = "alter.events";

function findUserByUsername(username: string) {
  const exact = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (exact) return exact;
  const all = db.select().from(schema.users).all();
  const lower = username.toLowerCase();
  return all.find((u) => (u.username || "").toLowerCase() === lower) || null;
}

function ensureSystemPublisher() {
  const existing = findUserByUsername(TELEGRAM_PUBLISHER_USERNAME);
  if (existing) return existing.id;

  const id = uuid();
  db.insert(schema.users)
    .values({
      id,
      email: "alter.events@alter.local",
      username: TELEGRAM_PUBLISHER_USERNAME,
      passwordHash: "!telegram-publisher-no-login",
      roleFlags: "cosplayer",
    })
    .run();
  db.insert(schema.profiles)
    .values({
      userId: id,
      displayName: "Cosplayers UZ",
      bio: "Автопостинг из Telegram-топика мероприятий",
      staffRole: "none",
    })
    .run();
  console.log(`[telegram] created publisher account @${TELEGRAM_PUBLISHER_USERNAME}`);
  return id;
}

export function resolvePublisherUserId() {
  const fromId = process.env.TELEGRAM_PUBLISH_USER_ID?.trim();
  if (fromId) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, fromId)).get();
    if (!user) throw new Error(`TELEGRAM_PUBLISH_USER_ID ${fromId} not found`);
    return user.id;
  }

  const fromName = process.env.TELEGRAM_PUBLISH_USERNAME?.trim();
  if (fromName) {
    const user = findUserByUsername(fromName);
    if (!user) throw new Error(`TELEGRAM_PUBLISH_USERNAME ${fromName} not found`);
    return user.id;
  }

  const owner = findUserByUsername(ADMIN_USERNAME);
  if (owner) return owner.id;

  const ownerProfile = db.select().from(schema.profiles).where(eq(schema.profiles.staffRole, "owner")).get();
  if (ownerProfile) return ownerProfile.userId;

  return ensureSystemPublisher();
}

export function ensureChannelMember(channelId: string, userId: string) {
  ensureCommunityRooms();
  const channel = db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).get();
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const existing = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(
        eq(schema.conversationMembers.conversationId, channel.conversationId),
        eq(schema.conversationMembers.userId, userId)
      )
    )
    .get();
  if (!existing) {
    db.insert(schema.conversationMembers)
      .values({ conversationId: channel.conversationId, userId, role: "member" })
      .run();
  }
  return channel.conversationId;
}

export function publishChannelMessage(input: {
  channelId: string;
  senderUserId: string;
  text?: string | null;
  mediaUrl?: string | null;
  type?: string;
  fileName?: string | null;
  fileSize?: number | null;
}) {
  const conversationId = ensureChannelMember(input.channelId, input.senderUserId);
  if (!input.text?.trim() && !input.mediaUrl) {
    throw new Error("text or mediaUrl required");
  }

  const id = uuid();
  db.insert(schema.messages)
    .values({
      id,
      conversationId,
      senderId: input.senderUserId,
      text: input.text?.trim() || null,
      mediaUrl: input.mediaUrl || null,
      type: input.type || (input.mediaUrl ? "image" : "text"),
      fileName: input.fileName || null,
      fileSize: input.fileSize || null,
      status: "sent",
    })
    .run();

  db.update(schema.conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(schema.conversationMembers.conversationId, conversationId),
        eq(schema.conversationMembers.userId, input.senderUserId)
      )
    )
    .run();

  const otherMembers = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, conversationId), ne(schema.conversationMembers.userId, input.senderUserId))
    )
    .all();

  for (const om of otherMembers) {
    notify(om.userId, "new_message", {
      conversationId,
      messageId: id,
      senderId: input.senderUserId,
    });
  }

  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, id)).get();
  const enriched = msg ? enrichMessage(msg) : null;
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId))
    .all()
    .map((m) => m.userId);

  realtime.broadcastToConversation(memberIds, {
    event: "message",
    data: { conversationId, message: enriched },
  });

  return enriched;
}

export const EVENTS_CHANNEL_ID = "ch-events";

export function publishEventsChannelMessage(input: {
  text?: string | null;
  mediaUrl?: string | null;
  type?: string;
  fileName?: string | null;
  fileSize?: number | null;
}) {
  const senderUserId = resolvePublisherUserId();
  return publishChannelMessage({
    channelId: EVENTS_CHANNEL_ID,
    senderUserId,
    ...input,
  });
}
