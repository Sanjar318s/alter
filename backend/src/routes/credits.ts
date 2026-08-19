import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/credits — credits for a target (build/photo/story)
router.get("/", (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    return res.status(400).json({ error: "targetType and targetId required" });
  }

  const creditsList = db
    .select()
    .from(schema.credits)
    .where(and(eq(schema.credits.targetType, targetType as string), eq(schema.credits.targetId, targetId as string)))
    .all();

  const enriched = creditsList.map((c) => {
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, c.creditedUserId))
      .get();
    return { ...c, username: user?.username || null };
  });

  res.json({ credits: enriched });
});

// POST /api/credits — add credit
router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { targetType, targetId, creditedUserId, role } = req.body;
  if (!targetType || !targetId || !creditedUserId || !role) {
    return res.status(400).json({ error: "All fields required" });
  }

  const id = uuid();
  db.insert(schema.credits)
    .values({
      id,
      targetType,
      targetId,
      creditedUserId,
      role,
    })
    .run();

  // Notify the credited user
  const notifId = uuid();
  db.insert(schema.notifications)
    .values({
      id: notifId,
      userId: creditedUserId,
      type: "credit_request",
      payloadJson: JSON.stringify({
        targetType,
        targetId,
        role,
        requesterId: req.userId,
      }),
    })
    .run();

  res.status(201).json({ creditId: id });
});

// PUT /api/credits/:id/confirm
router.put("/:id/confirm", authMiddleware, (req: AuthRequest, res) => {
  const credit = db
    .select()
    .from(schema.credits)
    .where(eq(schema.credits.id, req.params.id as string))
    .get();
  if (!credit) return res.status(404).json({ error: "Credit not found" });
  if (credit.creditedUserId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  db.update(schema.credits)
    .set({ confirmed: true })
    .where(eq(schema.credits.id, credit.id))
    .run();

  res.json({ ok: true });
});

export default router;
