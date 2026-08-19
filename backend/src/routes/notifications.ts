import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/unread-count", authMiddleware, (req: AuthRequest, res) => {
  const notifs = db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, req.userId!))
    .all()
    .filter((n) => !n.read);
  res.json({ count: notifs.length });
});

// GET /api/notifications — user's notifications
router.get("/", authMiddleware, (req: AuthRequest, res) => {
  const notifs = db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, req.userId!))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const limit = req.query.limit ? Number(req.query.limit) : notifs.length;
  res.json({ notifications: notifs.slice(0, limit) });
});

// PUT /api/notifications/:id/read
router.put("/:id/read", authMiddleware, (req: AuthRequest, res) => {
  db.update(schema.notifications)
    .set({ read: true })
    .where(eq(schema.notifications.id, req.params.id as string))
    .run();

  res.json({ ok: true });
});

// PUT /api/notifications/read-all
router.put("/read-all", authMiddleware, (req: AuthRequest, res) => {
  db.update(schema.notifications)
    .set({ read: true })
    .where(eq(schema.notifications.userId, req.userId!))
    .run();

  res.json({ ok: true });
});

export default router;
