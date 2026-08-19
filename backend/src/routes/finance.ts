import { Router } from "express";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { notify } from "../lib/notify";

const router = Router();

function totals(userId: string) {
  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, userId)).all();
  const received = orders.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const withdrawals = db.select().from(schema.withdrawals).where(eq(schema.withdrawals.userId, userId)).all();
  const pendingOut = withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);
  const paidOut = withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + w.amount, 0);
  return {
    received,
    pendingOut,
    paidOut,
    available: Math.max(0, received - pendingOut - paidOut),
    withdrawals,
    orders,
  };
}

router.get("/transactions", authMiddleware, (req: AuthRequest, res) => {
  const t = totals(req.userId!);
  const payments = t.orders.flatMap((o) =>
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.orderId, o.id))
      .all()
      .map((p) => ({
        id: p.id,
        type: "received" as const,
        amount: p.amount,
        status: "received",
        createdAt: p.createdAt,
        orderId: o.id,
        title: o.title,
        clientId: o.clientId,
      }))
  );
  const outs = t.withdrawals.map((w) => ({
    id: w.id,
    type: "withdrawal" as const,
    amount: w.amount,
    status: w.status,
    createdAt: w.createdAt,
    orderId: null,
    title: `Вывод (${w.method})`,
    clientId: null,
  }));
  const rows = [...payments, ...outs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const cursor = Number(req.query.cursor) || 0;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  res.json({
    available: t.available,
    pending: t.pendingOut,
    withdrawn: t.paidOut,
    received: t.received,
    transactions: rows.slice(cursor, cursor + limit),
    nextCursor: cursor + limit < rows.length ? cursor + limit : null,
  });
});

router.post("/withdrawals", authMiddleware, (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "card");
  const details = String(req.body.details || "");
  const t = totals(req.userId!);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Укажите сумму" });
  if (amount > t.available) return res.status(400).json({ error: "Сумма больше доступного баланса" });
  const id = uuid();
  db.insert(schema.withdrawals)
    .values({ id, userId: req.userId!, amount, method, details, status: "pending" })
    .run();
  notify(req.userId!, "withdrawal_pending", { id, amount });
  const row = db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).get();
  res.status(201).json({
    withdrawal: row,
    message: "Заявка на вывод отправлена. Обрабатывается вручную — деньги ещё не списаны провайдером.",
  });
});

export default router;
