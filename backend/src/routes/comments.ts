import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import { countsCommentForPremium, isDuplicateSpamComment } from "../lib/premium/commentFilter";
import { evaluateBloggerV1 } from "../lib/premium/evaluateBloggerV1";
const router = Router();
const MAX_LEN = 1000;

function bumpCount(targetType: string, targetId: string, delta: number) {
  if (targetType === "build") {
    const row = db.select().from(schema.builds).where(eq(schema.builds.id, targetId)).get();
    if (!row) return;
    db.update(schema.builds)
      .set({ commentsCount: Math.max(0, (row.commentsCount || 0) + delta) })
      .where(eq(schema.builds.id, targetId))
      .run();
    return;
  }
  if (targetType === "publication") {
    const row = db
      .select()
      .from(schema.publications)
      .where(eq(schema.publications.id, targetId))
      .get();
    if (!row) return;
    db.update(schema.publications)
      .set({ commentsCount: Math.max(0, (row.commentsCount || 0) + delta) })
      .where(eq(schema.publications.id, targetId))
      .run();
  }
}

function targetExists(targetType: string, targetId: string) {
  if (targetType === "build") {
    return !!db.select().from(schema.builds).where(eq(schema.builds.id, targetId)).get();
  }
  if (targetType === "publication") {
    return !!db.select().from(schema.publications).where(eq(schema.publications.id, targetId)).get();
  }
  return false;
}

function enrich(row: typeof schema.comments.$inferSelect) {
  const user = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).get();
  const profile = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, row.userId))
    .get();
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    userId: row.userId,
    username: user?.username || "user",
    displayName: profile?.displayName || user?.username || "user",
    avatarUrl: profile?.avatarUrl || null,
    text: row.text,
    parentId: row.parentId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function nest(
  rows: ReturnType<typeof enrich>[]
): (ReturnType<typeof enrich> & { replies: ReturnType<typeof enrich>[] })[] {
  const roots = rows.filter((c) => !c.parentId);
  return roots.map((root) => ({
    ...root,
    replies: rows.filter((c) => c.parentId === root.id),
  }));
}

router.get("/", (req, res) => {
  const targetType = String(req.query.targetType || "");
  const targetId = String(req.query.targetId || "");
  if (targetType !== "build" && targetType !== "publication") {
    return res.status(400).json({ error: "targetType must be build or publication" });
  }
  if (!targetId) return res.status(400).json({ error: "targetId required" });

  const rows = db
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.targetType, targetType), eq(schema.comments.targetId, targetId)))
    .all()
    .sort((a, b) => new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime());

  res.json({ comments: nest(rows.map(enrich)) });
});

router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { targetType, targetId, text, parentId } = req.body as {
    targetType?: string;
    targetId?: string;
    text?: string;
    parentId?: string | null;
  };

  if (targetType !== "build" && targetType !== "publication") {
    return res.status(400).json({ error: "targetType must be build or publication" });
  }
  if (!targetId) return res.status(400).json({ error: "targetId required" });
  const body = (text || "").trim();
  if (!body) return res.status(400).json({ error: "text required" });
  if (body.length > MAX_LEN) return res.status(400).json({ error: `max ${MAX_LEN} characters` });
  if (!targetExists(targetType, targetId)) return res.status(404).json({ error: "Target not found" });

  let rootParent: string | null = parentId || null;
  if (rootParent) {
    const parent = db.select().from(schema.comments).where(eq(schema.comments.id, rootParent)).get();
    if (!parent || parent.targetId !== targetId) {
      return res.status(400).json({ error: "Invalid parent" });
    }
    if (parent.parentId) rootParent = parent.parentId;
  }

  let countsForPremium = 0;
  if (targetType === "publication" && countsCommentForPremium(body)) {
    const recent = db
      .select()
      .from(schema.comments)
      .where(
        and(
          eq(schema.comments.targetType, "publication"),
          eq(schema.comments.targetId, targetId),
          eq(schema.comments.userId, req.userId!)
        )
      )
      .all()
      .map((c) => c.text);
    if (!isDuplicateSpamComment(body, recent)) countsForPremium = 1;
  }

  const id = uuid();
  db.insert(schema.comments)
    .values({
      id,
      targetType,
      targetId,
      userId: req.userId!,
      text: body,
      parentId: rootParent,
      countsForPremium,
    })
    .run();

  bumpCount(targetType, targetId, 1);

  if (targetType === "publication" && countsForPremium) {
    const pub = db.select().from(schema.publications).where(eq(schema.publications.id, targetId)).get();
    if (pub?.userId) {
      try {
        evaluateBloggerV1(pub.userId);
      } catch {
        /* non-fatal */
      }
    }
  }

  const row = db.select().from(schema.comments).where(eq(schema.comments.id, id)).get();
  res.status(201).json({ comment: enrich(row!) });
});

router.delete("/:id", authMiddleware, (req: AuthRequest, res) => {
  const row = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.id, req.params.id as string))
    .get();
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  const replies = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.parentId, row.id))
    .all();
  db.delete(schema.comments).where(eq(schema.comments.parentId, row.id)).run();
  db.delete(schema.comments).where(eq(schema.comments.id, row.id)).run();
  bumpCount(row.targetType, row.targetId, -(1 + replies.length));

  res.json({ ok: true });
});

export default router;
