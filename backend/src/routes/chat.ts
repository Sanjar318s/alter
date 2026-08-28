import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { v4 as uuid } from "uuid";
import { eq, and, or, ne } from "drizzle-orm";
import { ensureCommunityRooms, postBlacklistChannelCard } from "../lib/blacklistChannel";
import { notify } from "../lib/notify";
import { realtime } from "./realtime";
import { isOwnerById } from "../lib/owner";
import { detectProfanity, logAuditEvent } from "../lib/audit";
import { hasAdminPermission } from "../middleware/roles";
import { evaluateAndAutoBan } from "../lib/moderationAutomation";
import { autoAssignReport } from "../lib/reportAssignment";

const router = Router();

function isGhostModerator(req: AuthRequest) {
  if ((req.query.ghost as string | undefined) !== "1") return false;
  if (!req.userId) return false;
  if (isOwnerById(req.userId)) return true;
  return hasAdminPermission(req.userId, "canViewChats");
}

function parseManagerIds(json?: string | null) {
  try {
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function isOwnerByUserId(userId?: string | null) {
  return Boolean(userId && isOwnerById(userId));
}

function canPostToChannel(channel: any, userId: string) {
  if (!channel) return true;
  if ((channel.writeMode || "members") === "members") return true;
  if (isOwnerByUserId(userId)) return true;
  if ((channel.writeMode || "members") === "owner_only") return false;
  if ((channel.writeMode || "members") === "channel_admins") {
    const managerIds = parseManagerIds(channel.managerIdsJson);
    return managerIds.includes(userId);
  }
  return true;
}

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
    staffRole: isOwnerById(sender.id) ? "owner" : senderProfile?.staffRole || "none",
    staffBadgeHidden: Boolean(senderProfile?.staffBadgeHidden),
    avatarUrl: senderProfile?.avatarUrl || null,
  };
}

function enrichMessage(m: (typeof schema.messages.$inferSelect)) {
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

function unreadFor(userId: string) {
  const members = db.select().from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, userId)).all();
  let total = 0;
  for (const m of members) {
    const settings = db
      .select()
      .from(schema.conversationSettings)
      .where(
        and(
          eq(schema.conversationSettings.conversationId, m.conversationId),
          eq(schema.conversationSettings.userId, userId)
        )
      )
      .get();
    if (settings?.muted) continue;
    const lastRead = m.lastReadAt ? new Date(m.lastReadAt).getTime() : 0;
    const msgs = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, m.conversationId))
      .all()
      .filter((x) => !x.deleted && x.senderId !== userId && new Date(x.createdAt).getTime() > lastRead);
    total += msgs.length;
  }
  return total;
}

router.get("/unread-count", authMiddleware, (req: AuthRequest, res) => {
  res.json({ count: unreadFor(req.userId!) });
});

// ─── Conversations (DM) ──────────────────────────────────

// GET /api/messages — list user's conversations
router.get("/", authMiddleware, (req: AuthRequest, res) => {
  const members = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, req.userId!))
    .all();

  const convIds = members.map((m) => m.conversationId);
  const conversations = convIds
    .map((cid) => {
      const conv = db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, cid))
        .get();
      if (!conv) return null;

      const otherMembers = db
        .select()
        .from(schema.conversationMembers)
        .where(and(eq(schema.conversationMembers.conversationId, cid), ne(schema.conversationMembers.userId, req.userId!)))
        .all();

      const otherUsers = otherMembers.map((m) =>
        db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get()
      );

      const lastMsg = db
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.conversationId, cid), eq(schema.messages.deleted, false)))
        .all()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;

      const unread = lastMsg && members.find((m) => m.conversationId === cid);

      return {
        ...conv,
        members: otherUsers.filter(Boolean).map((u) => {
          const p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, u!.id)).get();
          return { id: u!.id, username: u!.username, avatarUrl: p?.avatarUrl || null };
        }),
        lastMessage: lastMsg
          ? { text: lastMsg.text, type: lastMsg.type, createdAt: lastMsg.createdAt, fileName: lastMsg.fileName }
          : null,
        lastReadAt: members.find((m) => m.conversationId === cid)?.lastReadAt,
        unread: (() => {
          const lastRead = members.find((x) => x.conversationId === cid)?.lastReadAt;
          const t = lastRead ? new Date(lastRead).getTime() : 0;
          return db
            .select()
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, cid))
            .all()
            .filter((x) => !x.deleted && x.senderId !== req.userId && new Date(x.createdAt).getTime() > t).length;
        })(),
        settings: db
          .select()
          .from(schema.conversationSettings)
          .where(
            and(eq(schema.conversationSettings.conversationId, cid), eq(schema.conversationSettings.userId, req.userId!))
          )
          .get() || { muted: false, pinned: false },
      };
    })
    .filter((c) => c && c.type !== "channel");

  res.json({ conversations });
});

router.get("/stream", (req: AuthRequest, res, next) => {
  const q = req.query.token as string | undefined;
  if (q && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${q}`;
  }
  next();
}, authMiddleware, (req: AuthRequest, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: ping\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  realtime.add(req.userId!, res);
  req.on("close", () => realtime.remove(req.userId!, res));
});

// GET /api/messages/:conversationId — messages in a conversation
router.get("/:conversationId", authMiddleware, (req: AuthRequest, res) => {
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, req.params.conversationId as string), eq(schema.conversationMembers.userId, req.userId!))
    )
    .get();
  const ghostViewer = isGhostModerator(req);
  if (!member && !ghostViewer) return res.status(403).json({ error: "Not a member" });

  const before = req.query.before ? new Date(String(req.query.before)).getTime() : Date.now() + 1;
  const limit = Math.min(Number(req.query.limit) || 80, 120);

  const msgs = db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, req.params.conversationId as string))
    .all()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((m) => m.createdAt.getTime() < before)
    .slice(-limit);

  const enriched = msgs.map((m) => enrichMessage(m));

  if (!ghostViewer) {
    db.update(schema.conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, req.params.conversationId as string),
          eq(schema.conversationMembers.userId, req.userId!)
        )
      )
      .run();
  }

  res.json({ messages: enriched });
});

// POST /api/messages/:conversationId — send message
router.post("/:conversationId", authMiddleware, (req: AuthRequest, res, next) => {
  const routeKey = String(req.params.conversationId || "").toLowerCase();
  // Let dedicated POST routes handle these paths.
  if (routeKey === "block" || routeKey === "report" || routeKey === "conversations") {
    return next();
  }
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, req.params.conversationId as string), eq(schema.conversationMembers.userId, req.userId!))
    )
    .get();
  if (!member) return res.status(403).json({ error: "Not a member" });

  const { text, mediaUrl, type, duration, fileName, fileSize, replyTo } = req.body;
  if (!text && !mediaUrl) return res.status(400).json({ error: "text or mediaUrl required" });
  const channel = db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.conversationId, req.params.conversationId as string))
    .get();
  if (!canPostToChannel(channel, req.userId!)) {
    if ((channel?.writeMode || "members") === "owner_only") {
      return res.status(403).json({ error: "Только владелец может писать в этом канале" });
    }
    if ((channel?.writeMode || "members") === "channel_admins") {
      return res.status(403).json({ error: "Только админы канала или владелец могут писать" });
    }
    return res.status(403).json({ error: "Нет прав писать в этом канале" });
  }

  const id = uuid();
  db.insert(schema.messages)
    .values({
      id,
      conversationId: req.params.conversationId as string,
      senderId: req.userId!,
      text: text || null,
      mediaUrl: mediaUrl || null,
      type: type || (mediaUrl ? "image" : "text"),
      duration: duration || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      replyTo: replyTo || null,
      status: "sent",
    })
    .run();
  const profanityHits = detectProfanity(text || "");
  if (profanityHits.length) {
    logAuditEvent({
      type: "profanity_detected",
      actorId: req.userId!,
      targetType: "message",
      targetId: id,
      severity: "warn",
      payload: { conversationId: req.params.conversationId, words: profanityHits },
    });
    evaluateAndAutoBan(req.userId!, "profanity");
  }

  // Update lastReadAt for sender
  db.update(schema.conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(eq(schema.conversationMembers.conversationId, req.params.conversationId as string), eq(schema.conversationMembers.userId, req.userId!))
    )
    .run();

  // Create notification for other members
  const otherMembers = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, req.params.conversationId as string), ne(schema.conversationMembers.userId, req.userId!))
    )
    .all();

  for (const om of otherMembers) {
    notify(om.userId, "new_message", {
      conversationId: req.params.conversationId,
      messageId: id,
      senderId: req.userId,
    });
  }

  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, id)).get();
  const enriched = msg ? enrichMessage(msg) : null;
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, req.params.conversationId as string))
    .all()
    .map((m) => m.userId);
  realtime.broadcastToConversation(memberIds, {
    event: "message",
    data: { conversationId: req.params.conversationId, message: enriched },
  });
  res.status(201).json({ message: enriched });
});

router.post("/:conversationId/typing", authMiddleware, (req: AuthRequest, res) => {
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, req.params.conversationId as string), eq(schema.conversationMembers.userId, req.userId!))
    )
    .get();
  if (!member) return res.status(403).json({ error: "Not a member" });
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, req.params.conversationId as string))
    .all()
    .map((m) => m.userId)
    .filter((id) => id !== req.userId);
  const me = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  realtime.broadcastToConversation(memberIds, {
    event: "typing",
    data: { conversationId: req.params.conversationId, userId: req.userId, username: me?.username },
  });
  res.json({ ok: true });
});

// POST /api/messages/conversations — create DM conversation
router.post("/conversations", authMiddleware, (req: AuthRequest, res) => {
  const { participantId } = req.body;
  if (!participantId) return res.status(400).json({ error: "participantId required" });
  if (participantId === req.userId) return res.status(400).json({ error: "Cannot DM yourself" });

  // Check privacy settings
  const participantProfile = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, participantId))
    .get();

  if (participantProfile?.privacySettings) {
    const settings = JSON.parse(participantProfile.privacySettings);
    if (settings.dmPolicy === "nobody") {
      return res.status(403).json({ error: "User does not accept DMs" });
    }
  }

  // Check blocks
  const blocked = db
    .select()
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, participantId), eq(schema.blocks.blockedId, req.userId!)),
        and(eq(schema.blocks.blockerId, req.userId!), eq(schema.blocks.blockedId, participantId))
      )
    )
    .get();
  if (blocked) return res.status(403).json({ error: "Cannot contact this user" });

  // Check if DM already exists
  const myMembers = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, req.userId!))
    .all();

  for (const mm of myMembers) {
    const conv = db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, mm.conversationId), eq(schema.conversations.type, "dm")))
      .get();
    if (!conv) continue;

    const otherMember = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(eq(schema.conversationMembers.conversationId, conv.id), eq(schema.conversationMembers.userId, participantId))
      )
      .get();
    if (otherMember) {
      return res.json({ conversationId: conv.id, existing: true });
    }
  }

  // Create new DM
  const convId = uuid();
  db.insert(schema.conversations)
    .values({ id: convId, type: "dm" })
    .run();
  db.insert(schema.conversationMembers)
    .values({ conversationId: convId, userId: req.userId!, role: "member" })
    .run();
  db.insert(schema.conversationMembers)
    .values({ conversationId: convId, userId: participantId, role: "member" })
    .run();

  res.status(201).json({ conversationId: convId, existing: false });
});

// ─── Channels ─────────────────────────────────────────────

router.get("/channels/list", authMiddleware, (req: AuthRequest, res) => {
  ensureCommunityRooms();
  const includeArchived =
    String(req.query.includeArchived || "") === "1" && isOwnerByUserId(req.userId);
  const chs = includeArchived
    ? db.select().from(schema.channels).all()
    : db.select().from(schema.channels).where(eq(schema.channels.archived, false)).all();
  const channels = chs
    .map((ch) => {
      const lastMsg = db
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.conversationId, ch.conversationId), eq(schema.messages.deleted, false)))
        .all()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
      const sender = lastMsg
        ? db.select().from(schema.users).where(eq(schema.users.id, lastMsg.senderId)).get()
        : null;
      const member = db
        .select()
        .from(schema.conversationMembers)
        .where(
          and(
            eq(schema.conversationMembers.conversationId, ch.conversationId),
            eq(schema.conversationMembers.userId, req.userId!)
          )
        )
        .get();
      const lastRead = member?.lastReadAt ? new Date(member.lastReadAt).getTime() : 0;
      const unread = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, ch.conversationId))
        .all()
        .filter((x) => !x.deleted && x.senderId !== req.userId && new Date(x.createdAt).getTime() > lastRead).length;
      const membersCount = db
        .select()
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, ch.conversationId))
        .all().length;
      const messagesCount = db
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.conversationId, ch.conversationId), eq(schema.messages.deleted, false)))
        .all().length;
      return {
        id: ch.id,
        conversationId: ch.conversationId,
        kind: ch.kind,
        title: ch.title,
        writeMode: ch.writeMode || "members",
        sortOrder: ch.sortOrder || 0,
        archived: Boolean(ch.archived),
        relatedFranchise: ch.relatedFranchise || null,
        relatedEventDate:
          ch.relatedEventDate instanceof Date
            ? ch.relatedEventDate.toISOString()
            : ch.relatedEventDate
              ? new Date(ch.relatedEventDate).toISOString()
              : null,
        managerIds: parseManagerIds(ch.managerIdsJson),
        managerUsernames: parseManagerIds(ch.managerIdsJson)
          .map((uid) => db.select().from(schema.users).where(eq(schema.users.id, uid)).get()?.username)
          .filter(Boolean),
        membersCount,
        messagesCount,
        lastMessage: lastMsg
          ? {
              text: lastMsg.text,
              type: lastMsg.type,
              createdAt: lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : lastMsg.createdAt,
              sender: sender?.username || "",
            }
          : null,
        unread,
      };
    })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title, "ru"));
  res.json({ channels });
});

// POST /api/messages/channels — create channel (owner only)
router.post("/channels", authMiddleware, (req: AuthRequest, res) => {
  if (!isOwnerByUserId(req.userId)) return res.status(403).json({ error: "Only owner can create channels" });
  const { kind, title, relatedFranchise, relatedEventDate } = req.body;
  if (!kind || !title) return res.status(400).json({ error: "kind and title required" });

  const convId = uuid();
  db.insert(schema.conversations)
    .values({ id: convId, type: "channel" })
    .run();

  const channelId = uuid();
  db.insert(schema.channels)
    .values({
      id: channelId,
      conversationId: convId,
      kind,
      title,
      relatedFranchise: relatedFranchise || null,
      relatedEventDate: relatedEventDate ? new Date(relatedEventDate) : null,
      writeMode: "members",
      sortOrder: Math.max(
        1,
        ...db
          .select()
          .from(schema.channels)
          .where(eq(schema.channels.kind, kind))
          .all()
          .map((c) => Number(c.sortOrder || 0))
      ) + 1,
      managerIdsJson: "[]",
    })
    .run();

  // Creator joins as owner
  db.insert(schema.conversationMembers)
    .values({ conversationId: convId, userId: req.userId!, role: "owner" })
    .run();

  res.status(201).json({ channelId, conversationId: convId });
});

// POST /api/messages/channels/:channelId/join
router.post("/channels/:channelId/join", authMiddleware, (req: AuthRequest, res) => {
  ensureCommunityRooms();
  const channel = db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.id, req.params.channelId as string))
    .get();
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  const existing = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(eq(schema.conversationMembers.conversationId, channel.conversationId), eq(schema.conversationMembers.userId, req.userId!))
    )
    .get();
  if (existing) return res.json({ ok: true, alreadyMember: true, conversationId: channel.conversationId });

  db.insert(schema.conversationMembers)
    .values({ conversationId: channel.conversationId, userId: req.userId!, role: "member" })
    .run();

  res.status(201).json({ ok: true, conversationId: channel.conversationId });
});

// GET /api/messages/channels/:channelId/members
router.get("/channels/:channelId/members", authMiddleware, (req: AuthRequest, res) => {
  ensureCommunityRooms();
  const channel = db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.id, req.params.channelId as string))
    .get();
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(
      and(
        eq(schema.conversationMembers.conversationId, channel.conversationId),
        eq(schema.conversationMembers.userId, req.userId!)
      )
    )
    .get();
  if (!member) return res.status(403).json({ error: "Not a member" });

  const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, channel.conversationId)).get();
  const rows = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, channel.conversationId))
    .all();

  const members = rows
    .map((m) => {
      const u = db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get();
      if (!u) return null;
      const p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get();
      return {
        id: u.id,
        username: u.username,
        avatarUrl: p?.avatarUrl || null,
        role: m.role || "member",
        staffRole: isOwnerById(u.id) ? "owner" : p?.staffRole || "none",
      };
    })
    .filter(Boolean);

  res.json({
    members,
    count: members.length,
    channel: {
      id: channel.id,
      title: channel.title,
      conversationId: channel.conversationId,
      writeMode: channel.writeMode || "members",
      createdAt: conv?.createdAt,
    },
  });
});

// POST /api/messages/channels/:channelId/leave
router.post("/channels/:channelId/leave", authMiddleware, (req: AuthRequest, res) => {
  ensureCommunityRooms();
  const channel = db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.id, req.params.channelId as string))
    .get();
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  if (isOwnerByUserId(req.userId) && (channel.writeMode || "members") === "owner_only") {
    return res.status(403).json({ error: "Владелец не может покинуть системный канал" });
  }

  db.delete(schema.conversationMembers)
    .where(
      and(
        eq(schema.conversationMembers.conversationId, channel.conversationId),
        eq(schema.conversationMembers.userId, req.userId!)
      )
    )
    .run();

  res.json({ ok: true });
});

// PATCH /api/messages/channels/reorder (owner only)
router.patch("/channels/reorder", authMiddleware, (req: AuthRequest, res) => {
  if (!isOwnerByUserId(req.userId)) return res.status(403).json({ error: "Only owner can manage channels" });
  ensureCommunityRooms();
  const { kind, orderedIds } = req.body as { kind?: string; orderedIds?: string[] };
  if (!kind || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: "kind and orderedIds required" });
  }

  orderedIds.forEach((id, index) => {
    const ch = db.select().from(schema.channels).where(eq(schema.channels.id, String(id))).get();
    if (ch && ch.kind === kind) {
      db.update(schema.channels).set({ sortOrder: index + 1 }).where(eq(schema.channels.id, ch.id)).run();
    }
  });

  logAuditEvent({
    type: "channel_reordered",
    actorId: req.userId!,
    targetType: "channel",
    targetId: kind,
    severity: "info",
    payload: { kind, orderedIds },
  });

  res.json({ ok: true });
});

// PATCH /api/messages/channels/:channelId/manage (owner only)
router.patch("/channels/:channelId/manage", authMiddleware, (req: AuthRequest, res) => {
  if (!isOwnerByUserId(req.userId)) return res.status(403).json({ error: "Only owner can manage channels" });
  ensureCommunityRooms();
  const channelId = req.params.channelId as string;
  const channel = db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).get();
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  const { title, writeMode, managerUsernames, move, archived, relatedFranchise, relatedEventDate } = req.body as {
    title?: string;
    writeMode?: "members" | "owner_only" | "channel_admins";
    managerUsernames?: string[];
    move?: "up" | "down";
    archived?: boolean;
    relatedFranchise?: string | null;
    relatedEventDate?: string | null;
  };

  let nextSortOrder = Number(channel.sortOrder || 0);
  if (move === "up" || move === "down") {
    const neighbors = db
      .select()
      .from(schema.channels)
      .where(and(eq(schema.channels.kind, channel.kind), eq(schema.channels.archived, false)))
      .all()
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.title.localeCompare(b.title, "ru"));
    const idx = neighbors.findIndex((x) => x.id === channel.id);
    const to = move === "up" ? idx - 1 : idx + 1;
    if (idx >= 0 && to >= 0 && to < neighbors.length) {
      const other = neighbors[to];
      const a = Number(channel.sortOrder || idx + 1);
      const b = Number(other.sortOrder || to + 1);
      db.update(schema.channels).set({ sortOrder: b }).where(eq(schema.channels.id, channel.id)).run();
      db.update(schema.channels).set({ sortOrder: a }).where(eq(schema.channels.id, other.id)).run();
      nextSortOrder = b;
    }
  }

  let managerIdsJson = channel.managerIdsJson || "[]";
  if (Array.isArray(managerUsernames)) {
    const ids = managerUsernames
      .map((u) => String(u || "").trim().toLowerCase())
      .filter(Boolean)
      .map((uname) => db.select().from(schema.users).where(eq(schema.users.username, uname)).get()?.id)
      .filter(Boolean) as string[];
    managerIdsJson = JSON.stringify([...new Set(ids)]);
  }

  const nextTitle = typeof title === "string" && title.trim() ? title.trim() : channel.title;
  const nextWriteMode = writeMode || (channel.writeMode as "members" | "owner_only" | "channel_admins") || "members";
  const nextArchived = typeof archived === "boolean" ? archived : Boolean(channel.archived);
  const nextRelatedFranchise =
    relatedFranchise === null
      ? null
      : typeof relatedFranchise === "string"
        ? relatedFranchise.trim() || null
        : channel.relatedFranchise;
  const nextRelatedEventDate =
    relatedEventDate === null
      ? null
      : typeof relatedEventDate === "string" && relatedEventDate.trim()
        ? new Date(relatedEventDate)
        : channel.relatedEventDate;
  db.update(schema.channels)
    .set({
      title: nextTitle,
      writeMode: nextWriteMode,
      managerIdsJson,
      sortOrder: nextSortOrder,
      archived: nextArchived,
      relatedFranchise: nextRelatedFranchise,
      relatedEventDate: nextRelatedEventDate,
    })
    .where(eq(schema.channels.id, channel.id))
    .run();

  logAuditEvent({
    type: "channel_settings_updated",
    actorId: req.userId!,
    targetType: "channel",
    targetId: channel.id,
    severity: "high",
    payload: {
      title: nextTitle,
      writeMode: nextWriteMode,
      managerUsernames: managerUsernames || null,
      move: move || null,
      archived: nextArchived,
      relatedFranchise: nextRelatedFranchise,
      relatedEventDate: nextRelatedEventDate instanceof Date ? nextRelatedEventDate.toISOString() : nextRelatedEventDate,
    },
  });

  const updated = db.select().from(schema.channels).where(eq(schema.channels.id, channel.id)).get();
  res.json({
    ok: true,
    channel: {
      id: updated?.id,
      title: updated?.title,
      writeMode: updated?.writeMode || "members",
      sortOrder: updated?.sortOrder || 0,
      archived: Boolean(updated?.archived),
      relatedFranchise: updated?.relatedFranchise || null,
      relatedEventDate:
        updated?.relatedEventDate instanceof Date
          ? updated.relatedEventDate.toISOString()
          : updated?.relatedEventDate
            ? new Date(updated.relatedEventDate).toISOString()
            : null,
      managerIds: parseManagerIds(updated?.managerIdsJson),
    },
  });
});

// DELETE /api/messages/channels/:channelId (owner only)
router.delete("/channels/:channelId", authMiddleware, (req: AuthRequest, res) => {
  if (!isOwnerByUserId(req.userId)) return res.status(403).json({ error: "Only owner can manage channels" });
  const channelId = req.params.channelId as string;
  const channel = db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).get();
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  const convId = channel.conversationId;
  db.delete(schema.channels).where(eq(schema.channels.id, channelId)).run();
  db.delete(schema.conversations).where(eq(schema.conversations.id, convId)).run();

  logAuditEvent({
    type: "channel_deleted",
    actorId: req.userId!,
    targetType: "channel",
    targetId: channelId,
    severity: "high",
    payload: { title: channel.title, conversationId: convId },
  });

  res.json({ ok: true });
});

// ─── Reports ──────────────────────────────────────────────

// POST /api/messages/report
router.post("/report", rateLimit(8, 60_000), authMiddleware, (req: AuthRequest, res) => {
  const { targetType, targetId, reason, details, files } = req.body;
  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: "targetType, targetId, reason required" });
  }

  const recent = db
    .select()
    .from(schema.reports)
    .where(and(eq(schema.reports.reporterId, req.userId!), eq(schema.reports.targetId, targetId)))
    .all()
    .find((r) => Date.now() - new Date(r.createdAt).getTime() < 10 * 60 * 1000);
  if (recent) return res.status(429).json({ error: "Жалоба на это уже отправлена" });

  const id = uuid();
  db.insert(schema.reports)
    .values({
      id,
      targetType,
      targetId,
      reporterId: req.userId!,
      reason,
      details: details || null,
      filesJson: files ? JSON.stringify(files) : null,
    })
    .run();
  autoAssignReport(id);

  let targetUserId: string | null = null;
  if (targetType === "user") targetUserId = String(targetId);
  if (targetType === "message") {
    const msg = db.select().from(schema.messages).where(eq(schema.messages.id, String(targetId))).get();
    if (msg?.senderId) targetUserId = msg.senderId;
  }
  if (targetUserId) {
    evaluateAndAutoBan(targetUserId, "report");
  }

  res.status(201).json({ reportId: id });
});

// ─── Blocks ───────────────────────────────────────────────

// POST /api/messages/block
router.post("/block", authMiddleware, (req: AuthRequest, res) => {
  const { blockedId, reason, details, files, source, durationHours } = req.body;
  if (!blockedId) return res.status(400).json({ error: "blockedId required" });
  if (isOwnerById(String(blockedId))) {
    return res.status(403).json({ error: "Нельзя заблокировать владельца платформы" });
  }

  const existing = db
    .select()
    .from(schema.blocks)
    .where(
      and(eq(schema.blocks.blockerId, req.userId!), eq(schema.blocks.blockedId, blockedId))
    )
    .get();
  if (existing) return res.json({ ok: true });

  const hours = Number(durationHours || 0);
  const expiresAt = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
  db.insert(schema.blocks)
    .values({
      blockerId: req.userId!,
      blockedId,
      reason: reason || null,
      details: details || null,
      filesJson: Array.isArray(files) ? JSON.stringify(files) : null,
      expiresAt,
      source: source === "blacklist" ? "blacklist" : "manual",
      createdBy: req.userId!,
    })
    .run();
  logAuditEvent({
    type: "user_blocked",
    actorId: req.userId!,
    targetType: "user",
    targetId: blockedId,
    severity: "high",
    payload: {
      reason: reason || null,
      details: details || null,
      files: Array.isArray(files) ? files : [],
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      source: source === "blacklist" ? "blacklist" : "manual",
    },
  });

  postBlacklistChannelCard({
    actorId: req.userId!,
    blockedUserId: blockedId,
    reason: reason || null,
    details: details || null,
    files: Array.isArray(files) ? files : [],
    expiresAt,
    source: source === "blacklist" ? "blacklist" : "manual",
  });

  res.status(201).json({ ok: true });
});

// DELETE /api/messages/block/:blockedId
router.delete("/block/:blockedId", authMiddleware, (req: AuthRequest, res) => {
  db.delete(schema.blocks)
    .where(
      and(eq(schema.blocks.blockerId, req.userId!), eq(schema.blocks.blockedId, req.params.blockedId as string))
    )
    .run();

  res.json({ ok: true });
});

router.get("/:conversationId/settings", authMiddleware, (req: AuthRequest, res) => {
  const cid = req.params.conversationId as string;
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, cid), eq(schema.conversationMembers.userId, req.userId!)))
    .get();
  if (!member) return res.status(403).json({ error: "Not a member" });
  const existing = db
    .select()
    .from(schema.conversationSettings)
    .where(and(eq(schema.conversationSettings.conversationId, cid), eq(schema.conversationSettings.userId, req.userId!)))
    .get();
  res.json({ muted: Boolean(existing?.muted), pinned: Boolean(existing?.pinned) });
});

router.patch("/:conversationId/settings", authMiddleware, (req: AuthRequest, res) => {
  const cid = req.params.conversationId as string;
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, cid), eq(schema.conversationMembers.userId, req.userId!)))
    .get();
  if (!member) return res.status(403).json({ error: "Not a member" });
  const existing = db
    .select()
    .from(schema.conversationSettings)
    .where(and(eq(schema.conversationSettings.conversationId, cid), eq(schema.conversationSettings.userId, req.userId!)))
    .get();
  const muted = req.body.muted ?? existing?.muted ?? false;
  const pinned = req.body.pinned ?? existing?.pinned ?? false;
  if (existing) {
    db.update(schema.conversationSettings)
      .set({ muted: Boolean(muted), pinned: Boolean(pinned) })
      .where(and(eq(schema.conversationSettings.conversationId, cid), eq(schema.conversationSettings.userId, req.userId!)))
      .run();
  } else {
    db.insert(schema.conversationSettings)
      .values({ conversationId: cid, userId: req.userId!, muted: Boolean(muted), pinned: Boolean(pinned) })
      .run();
  }
  res.json({ muted: Boolean(muted), pinned: Boolean(pinned) });
});

router.get("/:conversationId/attachments", authMiddleware, (req: AuthRequest, res) => {
  const cid = req.params.conversationId as string;
  const member = db
    .select()
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, cid), eq(schema.conversationMembers.userId, req.userId!)))
    .get();
  if (!member && !isGhostModerator(req)) return res.status(403).json({ error: "Not a member" });
  const type = String(req.query.type || "all");
  const msgs = db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, cid))
    .all()
    .filter((m) => !m.deleted);
  const items = msgs
    .filter((m) => {
      if (type === "media") return m.type === "image" || m.type === "video";
      if (type === "file") return m.type === "file";
      if (type === "link") return (m.text || "").includes("http");
      return Boolean(m.mediaUrl || (m.text || "").includes("http"));
    })
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: m.mediaUrl,
      text: m.text,
      fileName: m.fileName,
      createdAt: m.createdAt,
    }));
  res.json({ items });
});

router.patch("/m/:id", authMiddleware, (req: AuthRequest, res) => {
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, req.params.id as string)).get();
  if (!msg) return res.status(404).json({ error: "Not found" });
  if (msg.senderId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  if (Date.now() - new Date(msg.createdAt).getTime() > 15 * 60 * 1000) {
    return res.status(400).json({ error: "Редактирование доступно 15 минут" });
  }
  const text = String(req.body.text || "");
  db.update(schema.messages).set({ text, editedAt: new Date() }).where(eq(schema.messages.id, msg.id)).run();
  logAuditEvent({
    type: "message_edited",
    actorId: req.userId!,
    targetType: "message",
    targetId: msg.id,
    payload: { conversationId: msg.conversationId },
  });
  const updated = db.select().from(schema.messages).where(eq(schema.messages.id, msg.id)).get();
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, msg.conversationId))
    .all()
    .map((m) => m.userId);
  realtime.broadcastToConversation(memberIds, { event: "message_edit", data: { message: updated } });
  res.json({ message: updated });
});

router.delete("/m/:id", authMiddleware, (req: AuthRequest, res) => {
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, req.params.id as string)).get();
  if (!msg) return res.status(404).json({ error: "Not found" });
  if (msg.senderId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  db.update(schema.messages).set({ deleted: true, text: null, mediaUrl: null }).where(eq(schema.messages.id, msg.id)).run();
  logAuditEvent({
    type: "message_deleted",
    actorId: req.userId!,
    targetType: "message",
    targetId: msg.id,
    severity: "warn",
    payload: { conversationId: msg.conversationId },
  });
  const memberIds = db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, msg.conversationId))
    .all()
    .map((m) => m.userId);
  realtime.broadcastToConversation(memberIds, { event: "message_delete", data: { id: msg.id, conversationId: msg.conversationId } });
  res.json({ ok: true });
});

router.post("/m/:id/reactions", authMiddleware, (req: AuthRequest, res) => {
  const msg = db.select().from(schema.messages).where(eq(schema.messages.id, req.params.id as string)).get();
  if (!msg) return res.status(404).json({ error: "Not found" });
  const emoji = String(req.body.emoji || "");
  if (!emoji) return res.status(400).json({ error: "emoji required" });
  let map: Record<string, string[]> = {};
  try {
    map = msg.reactionsJson ? JSON.parse(msg.reactionsJson) : {};
  } catch {
    map = {};
  }
  const list = map[emoji] || [];
  map[emoji] = list.includes(req.userId!) ? list.filter((id) => id !== req.userId) : [...list, req.userId!];
  if (!map[emoji].length) delete map[emoji];
  db.update(schema.messages).set({ reactionsJson: JSON.stringify(map) }).where(eq(schema.messages.id, msg.id)).run();
  res.json({ reactions: map });
});

export default router;
