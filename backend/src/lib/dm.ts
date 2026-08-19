import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { realtime } from "../routes/realtime";

export function findOrCreateDm(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) {
    throw new Error("Need two different users for DM");
  }
  const myMembers = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, userA))
    .all();
  for (const mm of myMembers) {
    const conv = db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, mm.conversationId), eq(schema.conversations.type, "dm")))
      .get();
    if (!conv) continue;
    const other = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(eq(schema.conversationMembers.conversationId, conv.id), eq(schema.conversationMembers.userId, userB))
      )
      .get();
    if (other) return conv.id;
  }
  const convId = uuid();
  db.insert(schema.conversations).values({ id: convId, type: "dm" }).run();
  db.insert(schema.conversationMembers).values({ conversationId: convId, userId: userA, role: "member" }).run();
  db.insert(schema.conversationMembers).values({ conversationId: convId, userId: userB, role: "member" }).run();
  return convId;
}

export function postMessage(
  conversationId: string,
  senderId: string,
  data: { text?: string | null; mediaUrl?: string | null; type?: string }
) {
  if (!data.text && !data.mediaUrl) return null;
  const id = uuid();
  db.insert(schema.messages)
    .values({
      id,
      conversationId,
      senderId,
      text: data.text || null,
      mediaUrl: data.mediaUrl || null,
      type: data.type || (data.mediaUrl ? "image" : "text"),
      status: "sent",
    })
    .run();
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, id)).get();
  const sender = db.select().from(schema.users).where(eq(schema.users.id, senderId)).get();
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId))
    .all()
    .map((m) => m.userId);
  realtime.broadcastToConversation(memberIds, {
    event: "message",
    data: {
      conversationId,
      message: { ...msg, sender: sender ? { username: sender.username } : null },
    },
  });
  return msg;
}
