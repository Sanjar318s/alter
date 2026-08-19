import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import {
  campaignStats,
  listUserPartners,
  loadPartnerBundle,
  userPartnerRole,
} from "../lib/partnerHub";

const router = Router();
router.use(authMiddleware);

router.get("/", (req: AuthRequest, res) => {
  const partners = listUserPartners(req.userId!);
  res.json({ partners });
});

router.get("/:partnerId", (req: AuthRequest, res) => {
  const partnerId = String(req.params.partnerId);
  const mem = userPartnerRole(req.userId!, partnerId);
  if (!mem) return res.status(403).json({ error: "Нет доступа" });
  const partner = db.select().from(schema.partners).where(eq(schema.partners.id, partnerId)).get();
  if (!partner) return res.status(404).json({ error: "Не найден" });
  const bundle = loadPartnerBundle(partner.slug, false);
  const campaigns = db
    .select()
    .from(schema.adCampaigns)
    .where(eq(schema.adCampaigns.partnerId, partner.id))
    .all()
    .map((c) => ({ ...c, stats: campaignStats(c.id) }));
  res.json({ partner: bundle, campaigns, memberRole: mem.role });
});

router.patch("/:partnerId", (req: AuthRequest, res) => {
  const partnerId = String(req.params.partnerId);
  const mem = userPartnerRole(req.userId!, partnerId);
  if (!mem) return res.status(403).json({ error: "Нет доступа" });
  const row = db.select().from(schema.partners).where(eq(schema.partners.id, partnerId)).get();
  if (!row) return res.status(404).json({ error: "Не найден" });
  const { description, contactEmail, websiteUrl, logoUrl, coverUrl } = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (description !== undefined) patch.description = description;
  if (contactEmail !== undefined) patch.contactEmail = contactEmail;
  if (websiteUrl !== undefined) patch.websiteUrl = websiteUrl;
  if (logoUrl !== undefined) patch.logoUrl = logoUrl;
  if (coverUrl !== undefined) patch.coverUrl = coverUrl;
  db.update(schema.partners).set(patch as never).where(eq(schema.partners.id, row.id)).run();
  res.json({ ok: true });
});

router.get("/:partnerId/analytics", (req: AuthRequest, res) => {
  const partnerId = String(req.params.partnerId);
  const mem = userPartnerRole(req.userId!, partnerId);
  if (!mem) return res.status(403).json({ error: "Нет доступа" });
  const campaigns = db
    .select()
    .from(schema.adCampaigns)
    .where(eq(schema.adCampaigns.partnerId, partnerId))
    .all();
  res.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      stats: campaignStats(c.id),
    })),
  });
});

export default router;
