import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/stories — user's stories
router.get("/", authMiddleware, (req: AuthRequest, res) => {
  const storyList = db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.userId, req.userId!))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ stories: storyList });
});

// GET /api/stories/user/:userId — public stories of a user
router.get("/user/:userId", (req, res) => {
  const storyList = db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.userId, req.params.userId))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ stories: storyList });
});

// POST /api/stories — create story
router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { buildId, text, mediaUrl } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const id = uuid();
  db.insert(schema.stories)
    .values({
      id,
      userId: req.userId!,
      buildId: buildId || null,
      text,
      mediaUrl: mediaUrl || null,
    })
    .run();

  const story = db.select().from(schema.stories).where(eq(schema.stories.id, id)).get();
  res.status(201).json({ story });
});

// DELETE /api/stories/:id
router.delete("/:id", authMiddleware, (req: AuthRequest, res) => {
  const story = db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, req.params.id as string))
    .get();
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (story.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  db.delete(schema.stories).where(eq(schema.stories.id, story.id)).run();
  res.json({ ok: true });
});

export default router;
