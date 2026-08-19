import { Router } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { ownerOnly } from "../middleware/roles";
import { logAuditEvent } from "../lib/audit";
import {
  campaignStats,
  loadPartnerBundle,
  parseJson,
  serializePartner,
  uniqueEventSlug,
  uniquePartnerSlug,
} from "../lib/partnerHub";

const router = Router();
router.use(authMiddleware, adminMiddleware, ownerOnly);

router.get("/applications", (_req, res) => {
  const rows = db
    .select()
    .from(schema.partnerApplications)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ applications: rows });
});

router.post("/applications/:id/approve", (req: AuthRequest, res) => {
  const appId = String(req.params.id);
  const app = db.select().from(schema.partnerApplications).where(eq(schema.partnerApplications.id, appId)).get();
  if (!app) return res.status(404).json({ error: "Заявка не найдена" });
  if (app.status === "approved") return res.status(400).json({ error: "Уже одобрена" });

  const name = String(req.body?.name || app.contactName || "Partner").trim();
  const slug = String(req.body?.slug || uniquePartnerSlug(name));
  const partnerId = uuid();
  const now = new Date();

  db.insert(schema.partners)
    .values({
      id: partnerId,
      slug,
      type: app.type,
      name,
      city: app.city,
      contactEmail: app.contactEmail,
      description: app.message,
      status: "draft",
      featuresJson: JSON.stringify(req.body?.features || {}),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.update(schema.partnerApplications)
    .set({ status: "approved", reviewedBy: req.userId!, reviewedAt: now, partnerId })
    .where(eq(schema.partnerApplications.id, app.id))
    .run();

  const user = db.select().from(schema.users).where(eq(schema.users.email, app.contactEmail)).get();
  if (user) {
    db.insert(schema.partnerMembers)
      .values({ partnerId, userId: user.id, role: "owner" })
      .run();
  }

  logAuditEvent({
    type: "partner_application_approved",
    actorId: req.userId!,
    targetType: "partner",
    targetId: partnerId,
    payload: { applicationId: app.id, slug },
  });

  res.json({ ok: true, partnerId, slug });
});

router.post("/applications/:id/reject", (req: AuthRequest, res) => {
  const appId = String(req.params.id);
  const app = db.select().from(schema.partnerApplications).where(eq(schema.partnerApplications.id, appId)).get();
  if (!app) return res.status(404).json({ error: "Заявка не найдена" });
  db.update(schema.partnerApplications)
    .set({ status: "rejected", reviewedBy: req.userId!, reviewedAt: new Date() })
    .where(eq(schema.partnerApplications.id, app.id))
    .run();
  logAuditEvent({
    type: "partner_application_rejected",
    actorId: req.userId!,
    targetType: "partner",
    targetId: app.id,
  });
  res.json({ ok: true });
});

router.get("/", (_req, res) => {
  const rows = db.select().from(schema.partners).all().sort((a, b) => a.name.localeCompare(b.name));
  res.json({ partners: rows.map((p) => serializePartner(p)) });
});

router.post("/", (req: AuthRequest, res) => {
  const { name, type, slug, city, country, description, contactEmail, websiteUrl, status, packageTier, contractRef, features, activeFrom, activeUntil } =
    req.body as Record<string, unknown>;
  if (!name || !type) return res.status(400).json({ error: "name и type обязательны" });
  const id = uuid();
  const now = new Date();
  const finalSlug = String(slug || uniquePartnerSlug(String(name)));
  db.insert(schema.partners)
    .values({
      id,
      slug: finalSlug,
      type: String(type),
      name: String(name),
      city: city ? String(city) : null,
      country: country ? String(country) : null,
      description: description ? String(description) : null,
      contactEmail: contactEmail ? String(contactEmail) : null,
      websiteUrl: websiteUrl ? String(websiteUrl) : null,
      status: status ? String(status) : "draft",
      packageTier: packageTier ? String(packageTier) : null,
      contractRef: contractRef ? String(contractRef) : null,
      activeFrom: activeFrom ? new Date(String(activeFrom)) : null,
      activeUntil: activeUntil ? new Date(String(activeUntil)) : null,
      featuresJson: JSON.stringify(features || {}),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  logAuditEvent({ type: "partner_created", actorId: req.userId!, targetType: "partner", targetId: id });
  res.status(201).json({ ok: true, partner: serializePartner(db.select().from(schema.partners).where(eq(schema.partners.id, id)).get()!) });
});

router.get("/:id", (req, res) => {
  const row = db.select().from(schema.partners).where(eq(schema.partners.id, String(req.params.id))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const bundle = loadPartnerBundle(row.slug, false);
  res.json({ partner: bundle });
});

router.patch("/:id", (req: AuthRequest, res) => {
  const row = db.select().from(schema.partners).where(eq(schema.partners.id, String(req.params.id))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of [
    "name",
    "type",
    "city",
    "country",
    "description",
    "contactEmail",
    "websiteUrl",
    "status",
    "packageTier",
    "contractRef",
    "logoUrl",
    "coverUrl",
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (body.slug !== undefined) patch.slug = String(body.slug);
  if (body.features !== undefined) patch.featuresJson = JSON.stringify(body.features);
  if (body.activeFrom !== undefined) patch.activeFrom = body.activeFrom ? new Date(String(body.activeFrom)) : null;
  if (body.activeUntil !== undefined) patch.activeUntil = body.activeUntil ? new Date(String(body.activeUntil)) : null;
  db.update(schema.partners).set(patch as never).where(eq(schema.partners.id, row.id)).run();
  logAuditEvent({ type: "partner_updated", actorId: req.userId!, targetType: "partner", targetId: row.id, payload: patch });
  const updated = db.select().from(schema.partners).where(eq(schema.partners.id, row.id)).get()!;
  res.json({ ok: true, partner: serializePartner(updated) });
});

router.delete("/:id", (req: AuthRequest, res) => {
  db.delete(schema.partners).where(eq(schema.partners.id, String(req.params.id))).run();
  logAuditEvent({ type: "partner_deleted", actorId: req.userId!, targetType: "partner", targetId: String(req.params.id), severity: "warn" });
  res.json({ ok: true });
});

router.post("/:id/members", (req: AuthRequest, res) => {
  const { userId, role } = req.body as { userId?: string; role?: string };
  if (!userId) return res.status(400).json({ error: "userId обязателен" });
  db.insert(schema.partnerMembers)
    .values({ partnerId: String(req.params.id), userId, role: role || "editor" })
    .run();
  res.json({ ok: true });
});

router.post("/:id/makers", (req: AuthRequest, res) => {
  const { userId, badgeLabel, sortOrder } = req.body as { userId?: string; badgeLabel?: string; sortOrder?: number };
  if (!userId) return res.status(400).json({ error: "userId обязателен" });
  const id = uuid();
  db.insert(schema.partnerMakers)
    .values({ id, partnerId: String(req.params.id), userId, badgeLabel: badgeLabel || null, sortOrder: sortOrder ?? 0 })
    .run();
  res.status(201).json({ ok: true, id });
});

router.delete("/:id/makers/:makerRowId", (req: AuthRequest, res) => {
  db.delete(schema.partnerMakers).where(eq(schema.partnerMakers.id, String(req.params.makerRowId))).run();
  res.json({ ok: true });
});

router.post("/:id/rentals", (req: AuthRequest, res) => {
  const { title, description, photos, price, currency, size, franchise, status } = req.body as Record<string, unknown>;
  if (!title) return res.status(400).json({ error: "title обязателен" });
  const id = uuid();
  db.insert(schema.rentalItems)
    .values({
      id,
      partnerId: String(req.params.id),
      title: String(title),
      description: description ? String(description) : null,
      photosJson: JSON.stringify(photos || []),
      price: price != null ? Number(price) : null,
      currency: currency ? String(currency) : "UZS",
      size: size ? String(size) : null,
      franchise: franchise ? String(franchise) : null,
      status: status ? String(status) : "active",
    })
    .run();
  res.status(201).json({ ok: true, id });
});

router.patch("/rentals/:rentalId", (req: AuthRequest, res) => {
  const row = db.select().from(schema.rentalItems).where(eq(schema.rentalItems.id, String(req.params.rentalId))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "price", "currency", "size", "franchise", "status"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.photos !== undefined) patch.photosJson = JSON.stringify(body.photos);
  db.update(schema.rentalItems).set(patch as never).where(eq(schema.rentalItems.id, row.id)).run();
  res.json({ ok: true });
});

router.delete("/rentals/:rentalId", (_req, res) => {
  db.delete(schema.rentalItems).where(eq(schema.rentalItems.id, String(_req.params.rentalId))).run();
  res.json({ ok: true });
});

router.post("/:id/events", (req: AuthRequest, res) => {
  const { title, slug, city, startsAt, endsAt, channelId, coverUrl, program, links, status } = req.body as Record<string, unknown>;
  if (!title) return res.status(400).json({ error: "title обязателен" });
  const id = uuid();
  const eventSlug = String(slug || uniqueEventSlug(String(title)));
  db.insert(schema.partnerEvents)
    .values({
      id,
      partnerId: String(req.params.id),
      slug: eventSlug,
      title: String(title),
      city: city ? String(city) : null,
      startsAt: startsAt ? new Date(String(startsAt)) : null,
      endsAt: endsAt ? new Date(String(endsAt)) : null,
      channelId: channelId ? String(channelId) : null,
      coverUrl: coverUrl ? String(coverUrl) : null,
      programJson: JSON.stringify(program || []),
      linksJson: JSON.stringify(links || []),
      status: status ? String(status) : "draft",
    })
    .run();
  res.status(201).json({ ok: true, id, slug: eventSlug });
});

router.patch("/events/:eventId", (req: AuthRequest, res) => {
  const row = db.select().from(schema.partnerEvents).where(eq(schema.partnerEvents.id, String(req.params.eventId))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "slug", "city", "channelId", "coverUrl", "status"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.startsAt !== undefined) patch.startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
  if (body.endsAt !== undefined) patch.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
  if (body.program !== undefined) patch.programJson = JSON.stringify(body.program);
  if (body.links !== undefined) patch.linksJson = JSON.stringify(body.links);
  db.update(schema.partnerEvents).set(patch as never).where(eq(schema.partnerEvents.id, row.id)).run();
  res.json({ ok: true });
});

router.delete("/events/:eventId", (_req, res) => {
  db.delete(schema.partnerEvents).where(eq(schema.partnerEvents.id, String(_req.params.eventId))).run();
  res.json({ ok: true });
});

router.get("/:id/campaigns", (req, res) => {
  const rows = db.select().from(schema.adCampaigns).where(eq(schema.adCampaigns.partnerId, String(req.params.id))).all();
  res.json({
    campaigns: rows.map((c) => ({
      ...c,
      stats: campaignStats(c.id),
      targeting: parseJson(c.targetingJson, {}),
    })),
  });
});

router.post("/:id/campaigns", (req: AuthRequest, res) => {
  const { name, status, startsAt, endsAt, targeting, budgetCents, packageTier } = req.body as Record<string, unknown>;
  if (!name) return res.status(400).json({ error: "name обязателен" });
  const id = uuid();
  db.insert(schema.adCampaigns)
    .values({
      id,
      partnerId: String(req.params.id),
      name: String(name),
      status: status ? String(status) : "draft",
      startsAt: startsAt ? new Date(String(startsAt)) : null,
      endsAt: endsAt ? new Date(String(endsAt)) : null,
      targetingJson: JSON.stringify(targeting || {}),
      budgetCents: budgetCents != null ? Number(budgetCents) : null,
      packageTier: packageTier ? String(packageTier) : null,
    })
    .run();
  logAuditEvent({ type: "ad_campaign_created", actorId: req.userId!, targetType: "campaign", targetId: id });
  res.status(201).json({ ok: true, id });
});

router.patch("/campaigns/:campaignId", (req: AuthRequest, res) => {
  const row = db.select().from(schema.adCampaigns).where(eq(schema.adCampaigns.id, String(req.params.campaignId))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "status", "budgetCents", "packageTier"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.startsAt !== undefined) patch.startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
  if (body.endsAt !== undefined) patch.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
  if (body.targeting !== undefined) patch.targetingJson = JSON.stringify(body.targeting);
  db.update(schema.adCampaigns).set(patch as never).where(eq(schema.adCampaigns.id, row.id)).run();
  logAuditEvent({ type: "ad_campaign_updated", actorId: req.userId!, targetType: "campaign", targetId: row.id, payload: patch });
  res.json({ ok: true });
});

router.post("/campaigns/:campaignId/placements", (req: AuthRequest, res) => {
  const { slotId, creative, sortOrder, weight } = req.body as {
    slotId?: string;
    creative?: Record<string, unknown>;
    sortOrder?: number;
    weight?: number;
  };
  if (!slotId || !creative) return res.status(400).json({ error: "slotId и creative обязательны" });
  const id = uuid();
  db.insert(schema.adPlacements)
    .values({
      id,
      campaignId: String(req.params.campaignId),
      slotId,
      creativeJson: JSON.stringify(creative),
      sortOrder: sortOrder ?? 0,
      weight: weight ?? 100,
    })
    .run();
  logAuditEvent({ type: "ad_placement_created", actorId: req.userId!, targetType: "placement", targetId: id });
  res.status(201).json({ ok: true, id });
});

router.patch("/placements/:placementId", (req: AuthRequest, res) => {
  const row = db.select().from(schema.adPlacements).where(eq(schema.adPlacements.id, String(req.params.placementId))).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (body.slotId !== undefined) patch.slotId = body.slotId;
  if (body.creative !== undefined) patch.creativeJson = JSON.stringify(body.creative);
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  if (body.weight !== undefined) patch.weight = body.weight;
  db.update(schema.adPlacements).set(patch as never).where(eq(schema.adPlacements.id, row.id)).run();
  res.json({ ok: true });
});

router.delete("/placements/:placementId", (req: AuthRequest, res) => {
  db.delete(schema.adPlacements).where(eq(schema.adPlacements.id, String(req.params.placementId))).run();
  logAuditEvent({ type: "ad_placement_deleted", actorId: req.userId!, targetType: "placement", targetId: String(req.params.placementId), severity: "warn" });
  res.json({ ok: true });
});

router.get("/campaigns/:campaignId/report.csv", (req, res) => {
  const campaign = db.select().from(schema.adCampaigns).where(eq(schema.adCampaigns.id, String(req.params.campaignId))).get();
  if (!campaign) return res.status(404).json({ error: "Не найден" });
  const placements = db.select().from(schema.adPlacements).where(eq(schema.adPlacements.campaignId, campaign.id)).all();
  const stats = campaignStats(campaign.id);
  const lines = [
    "campaign,name,impressions,clicks,ctr",
    `${campaign.id},"${campaign.name.replace(/"/g, '""')}",${stats.impressions},${stats.clicks},${stats.ctr}`,
    "",
    "placement_id,slot_id,impressions,clicks",
  ];
  for (const p of placements) {
    const events = db.select().from(schema.adEvents).where(eq(schema.adEvents.placementId, p.id)).all();
    const imp = events.filter((e) => e.type === "impression").length;
    const clk = events.filter((e) => e.type === "click").length;
    lines.push(`${p.id},${p.slotId},${imp},${clk}`);
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${campaign.id}.csv"`);
  res.send(lines.join("\n"));
});

export default router;
