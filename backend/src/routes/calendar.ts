import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/events", authMiddleware, (req: AuthRequest, res) => {
  const from = req.query.from ? new Date(String(req.query.from)).getTime() : 0;
  const to = req.query.to ? new Date(String(req.query.to)).getTime() : Date.now() + 90 * 86400000;
  const events = db
    .select()
    .from(schema.calendarEvents)
    .where(eq(schema.calendarEvents.userId, req.userId!))
    .all()
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t >= from && t <= to;
    });
  const deadlines = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.makerId, req.userId!))
    .all()
    .filter((o) => o.deadline)
    .map((o) => ({
      id: `deadline-${o.id}`,
      type: "deadline" as const,
      title: o.title || "Заказ",
      startsAt: o.deadline,
      orderId: o.id,
      status: o.status,
    }));
  res.json({
    events: events.map((e) => ({ ...e, type: "event" as const })),
    deadlines,
  });
});

router.post("/events", authMiddleware, (req: AuthRequest, res) => {
  const { title, startsAt, endsAt, note, orderId } = req.body;
  if (!title || !startsAt) return res.status(400).json({ error: "title and startsAt required" });
  const id = uuid();
  db.insert(schema.calendarEvents)
    .values({
      id,
      userId: req.userId!,
      title,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      note: note || null,
      orderId: orderId || null,
    })
    .run();
  const event = db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id)).get();
  res.status(201).json({ event });
});

router.patch("/events/:id", authMiddleware, (req: AuthRequest, res) => {
  const event = db
    .select()
    .from(schema.calendarEvents)
    .where(eq(schema.calendarEvents.id, req.params.id as string))
    .get();
  if (!event) return res.status(404).json({ error: "Not found" });
  if (event.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const { title, startsAt, endsAt, note, orderId } = req.body;
  db.update(schema.calendarEvents)
    .set({
      ...(title !== undefined && { title }),
      ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
      ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      ...(note !== undefined && { note }),
      ...(orderId !== undefined && { orderId }),
    })
    .where(eq(schema.calendarEvents.id, event.id))
    .run();
  const updated = db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, event.id)).get();
  res.json({ event: updated });
});

router.delete("/events/:id", authMiddleware, (req: AuthRequest, res) => {
  const event = db
    .select()
    .from(schema.calendarEvents)
    .where(eq(schema.calendarEvents.id, req.params.id as string))
    .get();
  if (!event) return res.status(404).json({ error: "Not found" });
  if (event.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, event.id)).run();
  res.json({ ok: true });
});

export default router;
