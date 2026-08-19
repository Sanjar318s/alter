import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { notify } from "../lib/notify";
import { findOrCreateDm, postMessage } from "../lib/dm";

const router = Router();

// ─── Commissions ──────────────────────────────────────────

// GET /api/commissions — list open commissions
router.get("/", (_req, res) => {
  const commissions = db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.status, "open"))
    .all();
  res.json({ commissions });
});

// GET /api/commissions/:id
router.get("/:id", (req, res) => {
  const commission = db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.id, req.params.id))
    .get();
  if (!commission) return res.status(404).json({ error: "Commission not found" });

  const maker = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, commission.makerId))
    .get();

  res.json({ commission, maker: maker ? { username: maker.username } : null });
});

// POST /api/commissions — create (maker only)
router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const { title, description, priceFrom, turnaroundDays } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });

  const id = uuid();
  db.insert(schema.commissions)
    .values({
      id,
      makerId: req.userId!,
      title,
      description: description || null,
      priceFrom: priceFrom || null,
      turnaroundDays: turnaroundDays || null,
    })
    .run();

  const commission = db.select().from(schema.commissions).where(eq(schema.commissions.id, id)).get();
  res.status(201).json({ commission });
});

// PUT /api/commissions/:id
router.put("/:id", authMiddleware, (req: AuthRequest, res) => {
  const commission = db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.id, req.params.id as string))
    .get();
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.makerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  const { title, description, priceFrom, turnaroundDays, status } = req.body;
  db.update(schema.commissions)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(priceFrom !== undefined && { priceFrom }),
      ...(turnaroundDays !== undefined && { turnaroundDays }),
      ...(status !== undefined && { status }),
    })
    .where(eq(schema.commissions.id, commission.id))
    .run();

  const updated = db.select().from(schema.commissions).where(eq(schema.commissions.id, commission.id)).get();
  res.json({ commission: updated });
});

// ─── Commission Requests ──────────────────────────────────

// POST /api/commissions/:id/request
router.post("/:id/request", authMiddleware, (req: AuthRequest, res) => {
  const commission = db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.id, req.params.id as string))
    .get();
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.makerId === req.userId) return res.status(400).json({ error: "Нельзя заказать у себя" });

  const { contact, referencesJson, measurementsJson, character, budget, notes, description, referenceUrls, deadline, links } = req.body;
  const photos: string[] = Array.isArray(referenceUrls)
    ? referenceUrls.filter((u: unknown) => typeof u === "string")
    : [];
  const linkList: string[] = Array.isArray(links) ? links.filter((u: unknown) => typeof u === "string" && String(u).trim()) : [];
  const refsPayload = referencesJson || (photos.length || linkList.length ? JSON.stringify([...photos, ...linkList]) : null);
  const descriptionText = String(description || notes || "").trim();
  const characterText = String(character || "").trim();
  const budgetNum = budget != null && budget !== "" ? Number(budget) : commission.priceFrom;
  let deadlineDate: Date | null = null;
  if (deadline) {
    const d = new Date(String(deadline));
    if (!Number.isNaN(d.getTime())) deadlineDate = d;
  }
  if (!deadlineDate) return res.status(400).json({ error: "Укажите срок выполнения" });

  const requestId = uuid();
  db.insert(schema.commissionRequests)
    .values({
      id: requestId,
      commissionId: commission.id,
      requesterUserId: req.userId!,
      contact: contact || null,
      referencesJson: refsPayload,
      measurementsJson: measurementsJson || null,
    })
    .run();

  const convId = findOrCreateDm(req.userId!, commission.makerId);
  const orderId = uuid();
  const title = characterText || commission.title;
  db.insert(schema.orders)
    .values({
      id: orderId,
      commissionRequestId: requestId,
      makerId: commission.makerId,
      status: "new",
      title,
      character: characterText || null,
      clientId: req.userId!,
      budget: budgetNum != null ? Number(budgetNum) : null,
      notes: [descriptionText, deadlineDate ? `Срок до ${deadlineDate.toLocaleDateString("ru-RU")}` : "", linkList.length ? `Ссылки:\n${linkList.join("\n")}` : ""].filter(Boolean).join("\n") || null,
      filesJson: photos.length || linkList.length ? JSON.stringify([...photos, ...linkList]) : null,
      coverImage: photos[0] || null,
      conversationId: convId,
      deadline: deadlineDate,
    })
    .run();

  db.insert(schema.orderStatusHistory)
    .values({ id: uuid(), orderId, status: "new", note: "request" })
    .run();

  const client = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  const formText = JSON.stringify({
    orderId,
    kind: "order",
    character: characterText,
    budget: budgetNum,
    deadline: deadlineDate.toISOString(),
  });
  postMessage(convId, req.userId!, { text: formText, type: "order" });

  notify(commission.makerId, "commission_request", {
    orderId,
    conversationId: convId,
    requesterId: req.userId,
    requesterUsername: client?.username,
    title,
    text: `Новый заказ: ${title}`,
  });

  const request = db
    .select()
    .from(schema.commissionRequests)
    .where(eq(schema.commissionRequests.id, requestId))
    .get();

  res.status(201).json({ request, conversationId: convId, orderId });
});

// GET /api/commissions/:id/requests — maker sees incoming
router.get("/:id/requests", authMiddleware, (req: AuthRequest, res) => {
  const commission = db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.id, req.params.id as string))
    .get();
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.makerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  const requests = db
    .select()
    .from(schema.commissionRequests)
    .where(eq(schema.commissionRequests.commissionId, commission.id))
    .all();

  res.json({ requests });
});

export default router;
