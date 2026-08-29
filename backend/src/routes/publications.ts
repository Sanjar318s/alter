import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq, and, inArray, desc } from "drizzle-orm";
import { isOwnerById } from "../lib/owner";
import { enqueueSocialModeration, loadSocialAggregate } from "../lib/social/queue";
import { recordPublicationView } from "../lib/premium/recordView";
import { evaluateBloggerV1 } from "../lib/premium/evaluateBloggerV1";
import { getCached, publicCacheHeaders, setCached } from "../lib/shortCache";

const router = Router();

function enrichPublication(pub: typeof schema.publications.$inferSelect) {
  const mentions = db
    .select()
    .from(schema.publicationMentions)
    .where(eq(schema.publicationMentions.publicationId, pub.id))
    .all();
  let mediaUrls: string[] = [];
  let tags: string[] = [];
  try {
    mediaUrls = JSON.parse(pub.mediaJson || "[]");
  } catch {
    mediaUrls = [];
  }
  try {
    tags = JSON.parse(pub.tagsJson || "[]");
  } catch {
    tags = [];
  }
  return {
    ...pub,
    mediaUrls,
    tags,
    mentions: mentions.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.displayName,
      type: m.type,
      username: m.userId
        ? db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get()?.username
        : undefined,
    })),
  };
}

function getUserByUsername(username: string) {
  return db.select().from(schema.users).where(eq(schema.users.username, username)).get();
}

type PubRow = typeof schema.publications.$inferSelect;

// The libsql driver blocks the process per query (remote round-trip), so every
// endpoint here must issue a fixed number of batched queries, never N+1.
function enrichBatched(pubs: PubRow[], withAuthor: boolean) {
  const userIds = [...new Set(pubs.map((p) => p.userId).filter((id): id is string => Boolean(id)))];
  const usersById = new Map<string, typeof schema.users.$inferSelect>();
  const profilesByUserId = new Map<string, typeof schema.profiles.$inferSelect>();
  if (userIds.length) {
    for (const u of db.select().from(schema.users).where(inArray(schema.users.id, userIds)).all()) {
      usersById.set(u.id, u);
    }
    for (const p of db.select().from(schema.profiles).where(inArray(schema.profiles.userId, userIds)).all()) {
      profilesByUserId.set(p.userId, p);
    }
  }

  const mentionsByPubId = new Map<string, (typeof schema.publicationMentions.$inferSelect)[]>();
  const pubIds = pubs.map((p) => p.id);
  if (pubIds.length) {
    for (const m of db
      .select()
      .from(schema.publicationMentions)
      .where(inArray(schema.publicationMentions.publicationId, pubIds))
      .all()) {
      const arr = mentionsByPubId.get(m.publicationId);
      if (arr) arr.push(m);
      else mentionsByPubId.set(m.publicationId, [m]);
    }
  }

  const mentionUserIds = [
    ...new Set([...mentionsByPubId.values()].flat().map((m) => m.userId).filter((id): id is string => Boolean(id))),
  ];
  const usernamesById = new Map<string, string>();
  if (mentionUserIds.length) {
    for (const row of db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(inArray(schema.users.id, mentionUserIds))
      .all()) {
      usernamesById.set(row.id, row.username);
    }
  }

  const socialById = loadSocialAggregate("publication", pubIds);

  return pubs.map((pub) => {
    let mediaUrls: string[] = [];
    let tags: string[] = [];
    try {
      mediaUrls = JSON.parse(pub.mediaJson || "[]");
    } catch {
      mediaUrls = [];
    }
    try {
      tags = JSON.parse(pub.tagsJson || "[]");
    } catch {
      tags = [];
    }
    const base = {
      ...pub,
      mediaUrls,
      tags,
      social: socialById.get(pub.id) || null,
      mentions: (mentionsByPubId.get(pub.id) || []).map((m) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.displayName,
        type: m.type,
        username: m.userId ? usernamesById.get(m.userId) : undefined,
      })),
    };
    if (!withAuthor) return base;
    const author = pub.userId ? usersById.get(pub.userId) : undefined;
    const profile = author ? profilesByUserId.get(author.id) : undefined;
    return {
      ...base,
      author: author
        ? {
            id: author.id,
            username: author.username,
            displayName: profile?.displayName || author.username,
            avatarUrl: profile?.avatarUrl || null,
          }
        : null,
    };
  });
}

// GET /api/publications/feed — global reels/posts feed
router.get("/feed", (_req, res) => {
  const cacheKey = "publications:feed";
  const hit = getCached<{ publications: unknown[] }>(cacheKey, 30_000);
  if (hit) {
    publicCacheHeaders(res, 30);
    return res.json(hit);
  }

  const posts = db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.kind, "post"))
    .orderBy(desc(schema.publications.createdAt))
    .limit(40)
    .all();

  const payload = { publications: enrichBatched(posts, true) };
  setCached(cacheKey, payload);
  publicCacheHeaders(res, 30);
  res.json(payload);
});

// GET /api/publications/user/:username — posts
router.get("/user/:username", (req, res) => {
  const user = getUserByUsername(req.params.username as string);
  if (!user) return res.status(404).json({ error: "User not found" });

  const posts = db
    .select()
    .from(schema.publications)
    .where(and(eq(schema.publications.userId, user.id), eq(schema.publications.kind, "post")))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ publications: enrichBatched(posts, false) });
});

// GET /api/publications/user/:username/stories — active stories (<24h)
router.get("/user/:username/stories", (req, res) => {
  const user = getUserByUsername(req.params.username as string);
  if (!user) return res.status(404).json({ error: "User not found" });

  const now = new Date();
  const stories = db
    .select()
    .from(schema.publications)
    .where(and(eq(schema.publications.userId, user.id), eq(schema.publications.kind, "story")))
    .all()
    .filter((s) => !s.expiresAt || s.expiresAt > now)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  res.json({ stories: enrichBatched(stories, false) });
});

// POST /api/publications — create
router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { caption, mediaUrls, tags, mentions, kind } = req.body as {
    caption?: string;
    mediaUrls?: string[];
    tags?: string[];
    mentions?: { userId?: string; username?: string; displayName: string; type: "user" | "person" }[];
    kind?: "post" | "story";
  };

  if (!mediaUrls?.length) return res.status(400).json({ error: "mediaUrls required" });

  const me = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (me?.platformRole === "client" && !isOwnerById(me.id)) {
    return res.status(403).json({ error: "Клиент не может публиковать рилсы" });
  }

  const id = uuid();
  const pubKind = kind || "post";
  const expiresAt =
    pubKind === "story" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

  db.insert(schema.publications)
    .values({
      id,
      userId: req.userId!,
      caption: caption || null,
      mediaJson: JSON.stringify(mediaUrls),
      tagsJson: JSON.stringify(tags || []),
      kind: pubKind,
      expiresAt,
    })
    .run();

  for (const m of mentions || []) {
    let userId = m.userId || null;
    if (!userId && m.username) {
      const u = getUserByUsername(m.username);
      userId = u?.id || null;
    }
    db.insert(schema.publicationMentions)
      .values({
        id: uuid(),
        publicationId: id,
        userId,
        displayName: m.displayName,
        type: m.type,
      })
      .run();
  }

  const pub = db.select().from(schema.publications).where(eq(schema.publications.id, id)).get();
  if (pubKind === "post") {
    enqueueSocialModeration("publication", id, req.userId!);
  }
  const social = loadSocialAggregate("publication", [id]).get(id) || null;
  res.status(201).json({ publication: { ...enrichPublication(pub!), social } });
});

// POST /api/publications/:id/view — antifraud platform view for Premium
router.post("/:id/view", authMiddleware, (req: AuthRequest, res) => {
  const pub = db.select().from(schema.publications).where(eq(schema.publications.id, req.params.id as string)).get();
  if (!pub) return res.status(404).json({ error: "Not found" });
  const result = recordPublicationView(pub.id, req.userId!);
  if (result.counted && pub.userId) {
    try {
      evaluateBloggerV1(pub.userId);
    } catch {
      /* non-fatal */
    }
  }
  res.json(result);
});

router.post("/:id/like", authMiddleware, (req: AuthRequest, res) => {
  const pub = db.select().from(schema.publications).where(eq(schema.publications.id, req.params.id as string)).get();
  if (!pub) return res.status(404).json({ error: "Not found" });
  const existing = db
    .select()
    .from(schema.publicationLikes)
    .where(and(eq(schema.publicationLikes.userId, req.userId!), eq(schema.publicationLikes.publicationId, pub.id)))
    .get();
  if (!existing) {
    db.insert(schema.publicationLikes).values({ userId: req.userId!, publicationId: pub.id }).run();
    db.update(schema.publications).set({ likesCount: (pub.likesCount || 0) + 1 }).where(eq(schema.publications.id, pub.id)).run();
  }
  const updated = db.select().from(schema.publications).where(eq(schema.publications.id, pub.id)).get();
  res.json({ liked: true, likesCount: updated?.likesCount || 0 });
});

router.delete("/:id/like", authMiddleware, (req: AuthRequest, res) => {
  const pub = db.select().from(schema.publications).where(eq(schema.publications.id, req.params.id as string)).get();
  if (!pub) return res.status(404).json({ error: "Not found" });
  const existing = db
    .select()
    .from(schema.publicationLikes)
    .where(and(eq(schema.publicationLikes.userId, req.userId!), eq(schema.publicationLikes.publicationId, pub.id)))
    .get();
  if (existing) {
    db.delete(schema.publicationLikes)
      .where(and(eq(schema.publicationLikes.userId, req.userId!), eq(schema.publicationLikes.publicationId, pub.id)))
      .run();
    db.update(schema.publications)
      .set({ likesCount: Math.max(0, (pub.likesCount || 0) - 1) })
      .where(eq(schema.publications.id, pub.id))
      .run();
  }
  const updated = db.select().from(schema.publications).where(eq(schema.publications.id, pub.id)).get();
  res.json({ liked: false, likesCount: updated?.likesCount || 0 });
});

// DELETE /api/publications/:id
router.delete("/:id", authMiddleware, (req: AuthRequest, res) => {
  const pub = db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.id, req.params.id as string))
    .get();
  if (!pub) return res.status(404).json({ error: "Not found" });
  if (pub.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  db.delete(schema.publicationMentions)
    .where(eq(schema.publicationMentions.publicationId, pub.id))
    .run();
  db.delete(schema.publications).where(eq(schema.publications.id, pub.id)).run();
  res.json({ ok: true });
});

export default router;
