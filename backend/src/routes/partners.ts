import { Router } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db";
import { loadEventBySlug, loadPartnerBundle, partnerIsLive, serializePartner } from "../lib/partnerHub";
import { getCached, publicCacheHeaders, setCached } from "../lib/shortCache";

const router = Router();

router.get("/", (req, res) => {
  const type = String(req.query.type || "").trim();
  const city = String(req.query.city || "").trim().toLowerCase();
  const key = `partners:${type}:${city}`;
  const hit = getCached<{ partners: unknown[] }>(key, 60_000);
  if (hit) {
    publicCacheHeaders(res, 60);
    return res.json(hit);
  }
  const rows = db.select().from(schema.partners).all();
  const partners = rows
    .filter((p) => partnerIsLive(p))
    .filter((p) => (type ? p.type === type : true))
    .filter((p) => (city ? (p.city || "").toLowerCase().includes(city) : true))
    .map((p) => serializePartner(p));
  const payload = { partners };
  setCached(key, payload);
  publicCacheHeaders(res, 60);
  res.json(payload);
});

router.get("/events", (_req, res) => {
  const rows = db.select().from(schema.partnerEvents).where(eq(schema.partnerEvents.status, "active")).all();
  const events = rows
    .map((e) => {
      const partner = db.select().from(schema.partners).where(eq(schema.partners.id, e.partnerId)).get();
      if (!partner || !partnerIsLive(partner)) return null;
      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        city: e.city,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        coverUrl: e.coverUrl,
        partner: { slug: partner.slug, name: partner.name, logoUrl: partner.logoUrl },
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a!.startsAt || 0).getTime() - new Date(b!.startsAt || 0).getTime());
  res.json({ events });
});

router.get("/makers/:userId/badges", (req, res) => {
  const userId = String(req.params.userId);
  const rows = db.select().from(schema.partnerMakers).where(eq(schema.partnerMakers.userId, userId)).all();
  const badges = rows
    .map((m) => {
      const partner = db.select().from(schema.partners).where(eq(schema.partners.id, m.partnerId)).get();
      if (!partner || !partnerIsLive(partner)) return null;
      return {
        partnerSlug: partner.slug,
        partnerName: partner.name,
        badgeLabel: m.badgeLabel || `Резидент ${partner.name}`,
      };
    })
    .filter(Boolean);
  res.json({ badges });
});

router.get("/events/:slug", (req, res) => {
  const event = loadEventBySlug(String(req.params.slug));
  if (!event) return res.status(404).json({ error: "Событие не найдено" });
  res.json({ event });
});

router.get("/:slug", (req, res) => {
  const slug = String(req.params.slug);
  const bundle = loadPartnerBundle(slug, true);
  if (!bundle) return res.status(404).json({ error: "Партнёр не найден" });
  res.json({ partner: bundle });
});

router.post("/applications", (req, res) => {
  const { type, city, contactName, contactEmail, message } = req.body as {
    type?: string;
    city?: string;
    contactName?: string;
    contactEmail?: string;
    message?: string;
  };
  if (!type || !contactName?.trim() || !contactEmail?.trim()) {
    return res.status(400).json({ error: "Укажите тип, имя и email" });
  }
  const id = uuid();
  db.insert(schema.partnerApplications)
    .values({
      id,
      type: type.trim(),
      city: city?.trim() || null,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      message: message?.trim() || null,
      status: "new",
    })
    .run();
  res.status(201).json({ ok: true, applicationId: id });
});

export default router;
