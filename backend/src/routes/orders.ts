import { Router } from "express";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { notify } from "../lib/notify";
import { findOrCreateDm, postMessage } from "../lib/dm";
import { hasAdminPermission, isOwnerById } from "../middleware/roles";

const router = Router();

function person(userId: string | null | undefined) {
  if (!userId) return null;
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return null;
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  return {
    id: user.id,
    username: user.username,
    displayName: profile?.displayName || user.username,
    avatarUrl: profile?.avatarUrl || null,
  };
}

function ensureDm(makerId: string, clientId: string, existing?: string | null) {
  if (existing) return existing;
  return findOrCreateDm(makerId, clientId);
}

function enrichOrder(order: typeof schema.orders.$inferSelect, viewerId: string) {
  const history = db
    .select()
    .from(schema.orderStatusHistory)
    .where(eq(schema.orderStatusHistory.orderId, order.id))
    .all()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : new Date(h.createdAt).toISOString(),
    }));
  const payments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.orderId, order.id))
    .all();
  const client = person(order.clientId);
  return {
    ...order,
    client,
    maker: person(order.makerId),
    requester: client,
    viewerRole: order.makerId === viewerId ? "maker" : "client",
    history,
    payments,
  };
}

function recordStatus(orderId: string, status: string, note?: string) {
  db.insert(schema.orderStatusHistory)
    .values({ id: uuid(), orderId, status, note: note || null })
    .run();
}

function canGhostViewOrders(req: AuthRequest) {
  if ((req.query.ghost as string | undefined) !== "1") return false;
  if (!req.userId) return false;
  return isOwnerById(req.userId) || hasAdminPermission(req.userId, "canViewOrders");
}

function canGhostIntervene(req: AuthRequest) {
  return canGhostViewOrders(req) && (req.query.intervene as string | undefined) === "1";
}

// GET /api/orders
router.get("/", authMiddleware, (req: AuthRequest, res) => {
  const uid = req.userId!;
  const ghost = (req.query.ghost as string | undefined) === "1";
  const targetUser = String(req.query.targetUser || "").trim();
  const canGhostView = ghost && (isOwnerById(uid) || hasAdminPermission(uid, "canViewOrders"));
  const scopeUserId = canGhostView && targetUser ? targetUser : uid;
  const orders = db
    .select()
    .from(schema.orders)
    .all()
    .filter((o) => o.makerId === scopeUserId || o.clientId === scopeUserId);
  res.json({ orders: orders.map((o) => enrichOrder(o, scopeUserId)) });
});

// POST /api/orders — maker creates a studio order
router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { clientId, title, character, franchise, notes, deadline, budget, depositAmount, filesJson } = req.body;
  if (!clientId || !title || !deadline || budget == null) {
    return res.status(400).json({ error: "client, title, deadline and price required" });
  }
  const client = db.select().from(schema.users).where(eq(schema.users.id, clientId)).get();
  if (!client) return res.status(404).json({ error: "Client not found" });

  const commId = uuid();
  db.insert(schema.commissions)
    .values({
      id: commId,
      makerId: req.userId!,
      title,
      description: notes || null,
      priceFrom: Number(budget) || null,
      status: "open",
    })
    .run();

  const requestId = uuid();
  db.insert(schema.commissionRequests)
    .values({
      id: requestId,
      commissionId: commId,
      requesterUserId: clientId,
      referencesJson: filesJson || null,
      status: "new",
    })
    .run();

  const orderId = uuid();
  const status = "discussion";
  const conversationId = ensureDm(req.userId!, clientId);
  db.insert(schema.orders)
    .values({
      id: orderId,
      commissionRequestId: requestId,
      makerId: req.userId!,
      status,
      title,
      character: character || null,
      franchise: franchise || null,
      clientId,
      notes: notes || null,
      deadline: new Date(deadline),
      budget: Number(budget),
      depositAmount: depositAmount != null ? Number(depositAmount) : null,
      paidAmount: 0,
      remainingAmount: Number(budget),
      filesJson: filesJson || null,
      conversationId,
    })
    .run();
  recordStatus(orderId, status, "created");
  const maker = person(req.userId!);
  notify(clientId, "order_created", {
    orderId,
    title,
    conversationId,
    makerUsername: maker?.username,
    makerName: maker?.displayName,
  });
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get()!;
  res.status(201).json({ order: enrichOrder(order, req.userId!) });
});

router.get("/clients", authMiddleware, (req: AuthRequest, res) => {
  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, req.userId!)).all();
  const byClient = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.clientId) continue;
    const list = byClient.get(o.clientId) || [];
    list.push(o);
    byClient.set(o.clientId, list);
  }
  const clients = [...byClient.entries()].map(([id, list]) => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
    const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, id)).get();
    const note = db
      .select()
      .from(schema.clientNotes)
      .where(and(eq(schema.clientNotes.makerId, req.userId!), eq(schema.clientNotes.clientId, id)))
      .get();
    const spent = list.reduce((s, o) => s + (o.paidAmount || 0), 0);
    const last = list.sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : 0;
      const db_ = b.deadline ? new Date(b.deadline).getTime() : 0;
      return db_ - da;
    })[0];
    const active = list.some((o) => o.status !== "archive" && o.status !== "cancelled");
    return {
      id,
      username: user?.username,
      displayName: profile?.displayName,
      avatarUrl: profile?.avatarUrl,
      ordersCount: list.length,
      spent,
      lastOrderAt: last?.deadline || null,
      lastTitle: last?.title,
      kind: list.length > 1 ? "regular" : "new",
      active,
      note: note?.note || "",
    };
  });
  res.json({ clients });
});

router.patch("/clients/:userId/note", authMiddleware, (req: AuthRequest, res) => {
  const clientId = req.params.userId as string;
  const note = String(req.body.note || "");
  const existing = db
    .select()
    .from(schema.clientNotes)
    .where(and(eq(schema.clientNotes.makerId, req.userId!), eq(schema.clientNotes.clientId, clientId)))
    .get();
  if (existing) {
    db.update(schema.clientNotes)
      .set({ note })
      .where(and(eq(schema.clientNotes.makerId, req.userId!), eq(schema.clientNotes.clientId, clientId)))
      .run();
  } else {
    db.insert(schema.clientNotes).values({ makerId: req.userId!, clientId, note }).run();
  }
  res.json({ ok: true, note });
});

router.get("/:id", authMiddleware, (req: AuthRequest, res) => {
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id as string)).get();
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.makerId !== req.userId && order.clientId !== req.userId && !canGhostViewOrders(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ order: enrichOrder(order, req.userId!) });
});

function updateOrder(req: AuthRequest, res: import("express").Response) {
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id as string)).get();
  if (!order) return res.status(404).json({ error: "Order not found" });
  const moderator = canGhostIntervene(req);
  if (order.makerId !== req.userId && !moderator) return res.status(403).json({ error: "Forbidden" });

  const body = req.body || {};
  const nextStatus = body.status;
  db.update(schema.orders)
    .set({
      ...(nextStatus !== undefined && { status: nextStatus }),
      ...(body.pinned !== undefined && { pinned: Boolean(body.pinned) }),
      ...(body.trackingNumber !== undefined && { trackingNumber: body.trackingNumber }),
      ...(body.carrier !== undefined && { carrier: body.carrier }),
      ...(body.cancelReason !== undefined && { cancelReason: body.cancelReason }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.checklistJson !== undefined && { checklistJson: body.checklistJson }),
      ...(body.filesJson !== undefined && { filesJson: body.filesJson }),
      ...(body.deadline !== undefined && { deadline: new Date(body.deadline) }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.conversationId !== undefined && { conversationId: body.conversationId }),
    })
    .where(eq(schema.orders.id, order.id))
    .run();

  if (nextStatus && nextStatus !== order.status) {
    recordStatus(order.id, nextStatus, body.cancelReason || body.note);
    if (order.clientId) {
      notify(order.clientId, "order_status", {
        orderId: order.id,
        status: nextStatus,
        title: order.title,
      });
    }
  }

  const updated = db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get()!;
  res.json({ order: enrichOrder(updated, req.userId!) });
}

router.patch("/:id", authMiddleware, updateOrder);
router.put("/:id", authMiddleware, updateOrder);

const REJECT_LABELS: Record<string, string> = {
  no_slots: "Нет свободных слотов",
  not_this_character: "Не берусь за этого персонажа / франшизу",
  budget: "Бюджет не подходит",
  deadline: "Сроки нереальны",
  other: "Другая причина",
  client_nowait: "Клиент не хочет ждать",
};

router.post("/:id/decision", authMiddleware, (req: AuthRequest, res) => {
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id as string)).get();
  if (!order) return res.status(404).json({ error: "Order not found" });

  const action = String(req.body.action || "");
  const isMaker = order.makerId === req.userId;
  const isClient = order.clientId === req.userId;
  const moderator = canGhostIntervene(req);
  if (!isMaker && !isClient && !moderator) return res.status(403).json({ error: "Forbidden" });

  const convId = order.conversationId || (order.clientId ? ensureDm(order.makerId, order.clientId) : null);
  if (convId && !order.conversationId) {
    db.update(schema.orders).set({ conversationId: convId }).where(eq(schema.orders.id, order.id)).run();
  }

  if (isClient && !moderator) {
    if (action === "confirm_wait") {
      if (order.status !== "waiting") return res.status(400).json({ error: "Заявка не в ожидании" });
      recordStatus(order.id, "waiting", "client_confirm_wait");
      const text = `Клиент готов ждать по заказу «${order.title || "заказ"}», пока не освободитесь.`;
      if (convId) postMessage(convId, req.userId!, { text, type: "text" });
      notify(order.makerId, "order_status", { orderId: order.id, status: "waiting", title: order.title, text });
      const updated = db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get()!;
      return res.json({ order: enrichOrder(updated, req.userId!) });
    }
    if (action !== "reject") return res.status(400).json({ error: "Клиент может только отменить ожидание" });
    if (order.status !== "waiting" && order.status !== "new") {
      return res.status(400).json({ error: "Отменить можно заявку в ожидании или новую" });
    }
    const details = String(req.body.details || "").trim();
    const note = details ? `client_nowait: ${details}` : "client_nowait";
    db.update(schema.orders)
      .set({ status: "cancelled", cancelReason: note })
      .where(eq(schema.orders.id, order.id))
      .run();
    recordStatus(order.id, "cancelled", note);
    const text = `Клиент отменил заказ «${order.title || "заказ"}», не стал ждать ответа.${details ? `\n${details}` : ""}`;
    if (convId) postMessage(convId, req.userId!, { text, type: "text" });
    notify(order.makerId, "order_status", { orderId: order.id, status: "cancelled", title: order.title, text });
    const updated = db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get()!;
    return res.json({ order: enrichOrder(updated, req.userId!) });
  }

  if (order.status !== "new" && order.status !== "waiting") {
    return res.status(400).json({ error: "Решение уже принято" });
  }

  if (action === "accept") {
    db.update(schema.orders).set({ status: "discussion" }).where(eq(schema.orders.id, order.id)).run();
    recordStatus(order.id, "discussion", "accepted");
    const text = `Продавец принял заказ «${order.title || "заказ"}». Можно обсуждать детали здесь.`;
    if (convId) postMessage(convId, req.userId!, { text, type: "text" });
    if (order.clientId) notify(order.clientId, "order_status", { orderId: order.id, status: "discussion", title: order.title, text });
  } else if (action === "wait") {
    db.update(schema.orders).set({ status: "waiting" }).where(eq(schema.orders.id, order.id)).run();
    recordStatus(order.id, "waiting", String(req.body.details || "busy") || "busy");
    const extra = String(req.body.details || "").trim();
    const text = `Продавец поставил заказ «${order.title || "заказ"}» в ожидание — сейчас не хватает слотов.${extra ? `\n${extra}` : ""}\nМожно ждать или отменить заявку в студии.`;
    if (convId) postMessage(convId, req.userId!, { text, type: "text" });
    if (order.clientId) notify(order.clientId, "order_status", { orderId: order.id, status: "waiting", title: order.title, text });
  } else if (action === "reject") {
    const reason = String(req.body.reason || "");
    const details = String(req.body.details || "").trim();
    if (!reason || !details) return res.status(400).json({ error: "Нужны причина и описание отказа" });
    const label = REJECT_LABELS[reason] || reason;
    const note = `${reason}: ${details}`;
    db.update(schema.orders)
      .set({ status: "cancelled", cancelReason: note })
      .where(eq(schema.orders.id, order.id))
      .run();
    recordStatus(order.id, "cancelled", note);
    const text = `Продавец отклонил заказ «${order.title || "заказ"}».\nПричина: ${label}\n${details}`;
    if (convId) postMessage(convId, req.userId!, { text, type: "text" });
    if (order.clientId) notify(order.clientId, "order_status", { orderId: order.id, status: "cancelled", title: order.title, text });
  } else {
    return res.status(400).json({ error: "action: accept | wait | reject" });
  }

  const updated = db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get()!;
  res.json({ order: enrichOrder(updated, req.userId!) });
});

router.post("/:id/payments", authMiddleware, (req: AuthRequest, res) => {
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id as string)).get();
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.makerId !== req.userId && !canGhostIntervene(req)) return res.status(403).json({ error: "Forbidden" });
  const amount = Number(req.body.amount);
  const kind = String(req.body.kind || "partial");
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount required" });

  db.insert(schema.payments)
    .values({ id: uuid(), orderId: order.id, amount, kind })
    .run();
  const paid = (order.paidAmount || 0) + amount;
  const budget = order.budget || 0;
  db.update(schema.orders)
    .set({
      paidAmount: paid,
      remainingAmount: Math.max(0, budget - paid),
      depositPaid: paid > 0,
    })
    .where(eq(schema.orders.id, order.id))
    .run();
  if (order.clientId) notify(order.clientId, "payment", { orderId: order.id, amount, kind });
  const updated = db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get()!;
  res.status(201).json({ order: enrichOrder(updated, req.userId!) });
});

export default router;
