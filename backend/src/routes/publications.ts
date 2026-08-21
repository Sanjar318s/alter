import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";

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

// GET /api/publications/feed — global reels/posts feed
router.get("/feed", (_req, res) => {
  const limit = 40;
  const posts = db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.kind, "post"))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  const enriched = posts.map((pub) => {
    const author = db.select().from(schema.users).where(eq(schema.users.id, pub.userId)).get();
    const profile = author
      ? db.select().from(schema.profiles).where(eq(schema.profiles.userId, author.id)).get()
      : null;
    return {
      ...enrichPublication(pub),
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

  res.json({ publications: enriched });
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

  res.json({ publications: posts.map(enrichPublication) });
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

  res.json({ stories: stories.map(enrichPublication) });
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
  res.status(201).json({ publication: enrichPublication(pub!) });
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
