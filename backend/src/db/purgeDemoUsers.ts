import { and, eq, inArray, or } from "drizzle-orm";
import { db, schema, sqlite } from "./index";
import { DEMO_BUILD_IDS, isDemoUser } from "../lib/demoUsers";

const DEMO_CONVERSATION_IDS = ["conv-nyx-luna", "conv-ch-genshin"];
const DEMO_CHANNEL_IDS = ["ch-genshin"];
const DEMO_ORDER_IDS = ["ord-raiden", "ord-yae", "ord-2b", "ord-jinx", "ord-dva", "ord-miku"];
const DEMO_COMMISSION_IDS = ["comm-nyx"];
const DEMO_PUBLICATION_IDS = ["pub-1", "pub-2", "pub-3", "pub-4", "pub-5", "pub-6", "story-1", "story-2"];

function deleteOrdersForUser(userId: string) {
  const orders = db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(or(eq(schema.orders.makerId, userId), eq(schema.orders.clientId, userId)))
    .all();
  for (const order of orders) {
    db.delete(schema.payments).where(eq(schema.payments.orderId, order.id)).run();
    db.delete(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, order.id)).run();
  }
  if (orders.length) {
    db.delete(schema.orders)
      .where(or(eq(schema.orders.makerId, userId), eq(schema.orders.clientId, userId)))
      .run();
  }
}

function deleteUserRefs(userId: string) {
  db.delete(schema.messages).where(eq(schema.messages.senderId, userId)).run();
  deleteOrdersForUser(userId);
  db.delete(schema.reports)
    .where(or(eq(schema.reports.reporterId, userId), eq(schema.reports.targetId, userId), eq(schema.reports.assignedTo, userId)))
    .run();
  db.delete(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, userId), eq(schema.blocks.blockedId, userId)))
    .run();
  db.delete(schema.credits).where(eq(schema.credits.creditedUserId, userId)).run();
  db.delete(schema.commissionRequests).where(eq(schema.commissionRequests.requesterUserId, userId)).run();
  db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.userId, userId)).run();
  db.delete(schema.conversationSettings).where(eq(schema.conversationSettings.userId, userId)).run();
}

function deleteDemoContentById() {
  for (const orderId of DEMO_ORDER_IDS) {
    db.delete(schema.payments).where(eq(schema.payments.orderId, orderId)).run();
    db.delete(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, orderId)).run();
    db.delete(schema.orders).where(eq(schema.orders.id, orderId)).run();
  }

  for (const commissionId of DEMO_COMMISSION_IDS) {
    const requests = db
      .select({ id: schema.commissionRequests.id })
      .from(schema.commissionRequests)
      .where(eq(schema.commissionRequests.commissionId, commissionId))
      .all();
    for (const req of requests) {
      db.delete(schema.orders).where(eq(schema.orders.commissionRequestId, req.id)).run();
    }
    db.delete(schema.commissionRequests).where(eq(schema.commissionRequests.commissionId, commissionId)).run();
    db.delete(schema.commissions).where(eq(schema.commissions.id, commissionId)).run();
  }

  for (const publicationId of DEMO_PUBLICATION_IDS) {
    db.delete(schema.publicationMentions).where(eq(schema.publicationMentions.publicationId, publicationId)).run();
    db.delete(schema.publicationLikes).where(eq(schema.publicationLikes.publicationId, publicationId)).run();
    db.delete(schema.publications).where(eq(schema.publications.id, publicationId)).run();
  }

  for (const buildId of DEMO_BUILD_IDS) {
    db.delete(schema.buildLikes).where(eq(schema.buildLikes.buildId, buildId)).run();
    db.delete(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, buildId)).run();
    db.delete(schema.comments)
      .where(and(eq(schema.comments.targetType, "build"), eq(schema.comments.targetId, buildId)))
      .run();
    db.delete(schema.builds).where(eq(schema.builds.id, buildId)).run();
  }

  for (const conversationId of DEMO_CONVERSATION_IDS) {
    db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId)).run();
    db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, conversationId)).run();
    db.delete(schema.conversationSettings).where(eq(schema.conversationSettings.conversationId, conversationId)).run();
    db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId)).run();
  }

  for (const channelId of DEMO_CHANNEL_IDS) {
    db.delete(schema.channels).where(eq(schema.channels.id, channelId)).run();
  }
}

export function purgeDemoUsers() {
  const demoUsers = db.select().from(schema.users).all().filter(isDemoUser);
  if (!demoUsers.length) {
    deleteDemoContentById();
    return { removedUsers: 0, usernames: [] as string[] };
  }

  const demoIds = demoUsers.map((u) => u.id);
  const usernames = demoUsers.map((u) => u.username);

  sqlite.transaction(() => {
    deleteDemoContentById();
    for (const userId of demoIds) {
      deleteUserRefs(userId);
    }
    db.delete(schema.users).where(inArray(schema.users.id, demoIds)).run();
  })();

  return { removedUsers: demoUsers.length, usernames };
}
