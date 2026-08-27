import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/studio", authMiddleware, (req: AuthRequest, res) => {
  const period = String(req.query.period || "30d");
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "year" ? 365 : 30;
  const since = Date.now() - days * 86400000;

  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, req.userId!)).all();
  const inPeriod = orders.filter((o) => {
    const t = o.deadline ? new Date(o.deadline).getTime() : 0;
    return t >= since || true;
  });

  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status || "new"] = (byStatus[o.status || "new"] || 0) + 1;

  const incomeByMonth: Record<string, number> = {};
  for (const o of orders) {
    const pays = db.select().from(schema.payments).where(eq(schema.payments.orderId, o.id)).all();
    for (const p of pays) {
      const d = new Date(p.createdAt);
      if (d.getTime() < since) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      incomeByMonth[key] = (incomeByMonth[key] || 0) + p.amount;
    }
  }

  const paid = orders.filter((o) => (o.paidAmount || 0) > 0).length;
  const conversion = orders.length ? Math.round((paid / orders.length) * 100) : 0;

  const byCat: Record<string, number> = {};
  for (const o of orders) {
    const k = o.franchise || "Другое";
    byCat[k] = (byCat[k] || 0) + 1;
  }

  const follows = db.select().from(schema.follows).where(eq(schema.follows.followingId, req.userId!)).all();
  const followerGrowth = follows.filter((f) => new Date(f.createdAt).getTime() >= since).length;

  const members = db.select().from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, req.userId!)).all();
  let replySamples = 0;
  let replyTotal = 0;
  for (const m of members) {
    const msgs = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, m.conversationId))
      .all()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const firstIn = msgs.find((x) => x.senderId !== req.userId);
    const firstOut = msgs.find((x) => x.senderId === req.userId && firstIn && new Date(x.createdAt) > new Date(firstIn.createdAt));
    if (firstIn && firstOut) {
      replySamples += 1;
      replyTotal += new Date(firstOut.createdAt).getTime() - new Date(firstIn.createdAt).getTime();
    }
  }

  const paymentsLive = process.env.PAYMENTS_LIVE === "true" || process.env.PAYMENTS_LIVE === "1";

  res.json({
    period,
    ordersCount: orders.length,
    byStatus,
    incomeByMonth: paymentsLive ? incomeByMonth : {},
    conversion: paymentsLive ? conversion : null,
    paymentsLive,
    incomeNote: paymentsLive
      ? null
      : "Доход и конверсия в оплату скрыты: выплаты на площадке ещё не включены (PAYMENTS_LIVE).",
    topCategories: Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count })),
    followerGrowth,
    avgReplyMs: replySamples ? Math.round(replyTotal / replySamples) : null,
  });
});

export default router;
