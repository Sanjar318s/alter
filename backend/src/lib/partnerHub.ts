import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db";

export type PartnerFeatures = {
  event?: boolean;
  rental?: boolean;
  ads?: boolean;
  makers?: boolean;
};

export type AdCreative = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  partnerSlug?: string;
};

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "partner";
}

export function uniquePartnerSlug(base: string) {
  let slug = slugify(base);
  let n = 0;
  while (db.select().from(schema.partners).where(eq(schema.partners.slug, slug)).get()) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

export function uniqueEventSlug(base: string) {
  let slug = slugify(base);
  let n = 0;
  while (db.select().from(schema.partnerEvents).where(eq(schema.partnerEvents.slug, slug)).get()) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function partnerIsLive(row: {
  status?: string | null;
  activeFrom?: Date | null;
  activeUntil?: Date | null;
}) {
  if (row.status !== "active") return false;
  const now = Date.now();
  if (row.activeFrom && new Date(row.activeFrom).getTime() > now) return false;
  if (row.activeUntil && new Date(row.activeUntil).getTime() < now) return false;
  return true;
}

export function campaignIsLive(row: {
  status?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  if (row.status !== "active" && row.status !== "scheduled") return false;
  const now = Date.now();
  if (row.startsAt && new Date(row.startsAt).getTime() > now) return false;
  if (row.endsAt && new Date(row.endsAt).getTime() < now) return false;
  if (row.status === "scheduled" && row.startsAt && new Date(row.startsAt).getTime() <= now) {
    return true;
  }
  return row.status === "active";
}

export function serializePartner(row: typeof schema.partners.$inferSelect, extras?: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: row.name,
    city: row.city,
    country: row.country,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    description: row.description,
    contactEmail: row.contactEmail,
    websiteUrl: row.websiteUrl,
    status: row.status,
    packageTier: row.packageTier,
    contractRef: row.contractRef,
    activeFrom: row.activeFrom,
    activeUntil: row.activeUntil,
    features: parseJson<PartnerFeatures>(row.featuresJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  };
}

export function loadPartnerBundle(slug: string, publicOnly = true) {
  const partner = db.select().from(schema.partners).where(eq(schema.partners.slug, slug)).get();
  if (!partner) return null;
  if (publicOnly && !partnerIsLive(partner)) return null;

  const makers = db
    .select()
    .from(schema.partnerMakers)
    .where(eq(schema.partnerMakers.partnerId, partner.id))
    .all()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((m) => {
      const user = db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get();
      const profile = user
        ? db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get()
        : null;
      return {
        id: m.id,
        userId: m.userId,
        username: user?.username,
        avatarUrl: profile?.avatarUrl,
        badgeLabel: m.badgeLabel,
        sortOrder: m.sortOrder,
      };
    })
    .filter((m) => m.username);

  const rentals = db
    .select()
    .from(schema.rentalItems)
    .where(and(eq(schema.rentalItems.partnerId, partner.id), eq(schema.rentalItems.status, "active")))
    .all()
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      photos: parseJson<string[]>(r.photosJson, []),
      price: r.price,
      currency: r.currency,
      size: r.size,
      franchise: r.franchise,
      availableFrom: r.availableFrom,
      availableTo: r.availableTo,
    }));

  const events = db
    .select()
    .from(schema.partnerEvents)
    .where(and(eq(schema.partnerEvents.partnerId, partner.id), eq(schema.partnerEvents.status, "active")))
    .all()
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      city: e.city,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      channelId: e.channelId,
      coverUrl: e.coverUrl,
      program: parseJson(e.programJson, []),
      links: parseJson(e.linksJson, []),
    }));

  return serializePartner(partner, { makers, rentals, events });
}

export function loadEventBySlug(slug: string) {
  const event = db.select().from(schema.partnerEvents).where(eq(schema.partnerEvents.slug, slug)).get();
  if (!event || event.status !== "active") return null;
  const partner = db.select().from(schema.partners).where(eq(schema.partners.id, event.partnerId)).get();
  if (!partner || !partnerIsLive(partner)) return null;
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    city: event.city,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    channelId: event.channelId,
    coverUrl: event.coverUrl,
    program: parseJson(event.programJson, []),
    links: parseJson(event.linksJson, []),
    partner: serializePartner(partner),
  };
}

export function pickPlacement(slotId: string, city?: string) {
  const now = Date.now();
  const placements = db.select().from(schema.adPlacements).where(eq(schema.adPlacements.slotId, slotId)).all();
  if (!placements.length) return null;

  const eligible: Array<{
    placement: typeof schema.adPlacements.$inferSelect;
    campaign: typeof schema.adCampaigns.$inferSelect;
    partner: typeof schema.partners.$inferSelect;
    creative: AdCreative;
  }> = [];

  for (const placement of placements) {
    const campaign = db.select().from(schema.adCampaigns).where(eq(schema.adCampaigns.id, placement.campaignId)).get();
    if (!campaign || !campaignIsLive(campaign)) continue;
    const partner = db.select().from(schema.partners).where(eq(schema.partners.id, campaign.partnerId)).get();
    if (!partner || !partnerIsLive(partner)) continue;
    const targeting = parseJson<{ cities?: string[] }>(campaign.targetingJson, {});
    if (city && targeting.cities?.length && !targeting.cities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      continue;
    }
    const creative = parseJson<AdCreative>(placement.creativeJson, { title: partner.name });
    eligible.push({
      placement,
      campaign,
      partner,
      creative: { ...creative, partnerSlug: creative.partnerSlug || partner.slug, ctaUrl: creative.ctaUrl || `/partners/${partner.slug}` },
    });
  }

  if (!eligible.length) return null;

  const totalWeight = eligible.reduce((s, e) => s + (e.placement.weight || 100), 0);
  let roll = Math.random() * totalWeight;
  for (const item of eligible) {
    roll -= item.placement.weight || 100;
    if (roll <= 0) {
      return {
        placementId: item.placement.id,
        slotId: item.placement.slotId,
        campaignId: item.campaign.id,
        partner: serializePartner(item.partner),
        creative: item.creative,
      };
    }
  }
  const first = eligible[0];
  return {
    placementId: first.placement.id,
    slotId: first.placement.slotId,
    campaignId: first.campaign.id,
    partner: serializePartner(first.partner),
    creative: first.creative,
  };
}

export function recordAdEvent(input: {
  placementId: string;
  type: "impression" | "click";
  userId?: string | null;
  sessionId?: string | null;
  city?: string | null;
}) {
  db.insert(schema.adEvents)
    .values({
      id: uuid(),
      placementId: input.placementId,
      type: input.type,
      userId: input.userId || null,
      sessionId: input.sessionId || null,
      city: input.city || null,
    })
    .run();
}

export function userPartnerRole(userId: string, partnerId: string) {
  return db
    .select()
    .from(schema.partnerMembers)
    .where(and(eq(schema.partnerMembers.partnerId, partnerId), eq(schema.partnerMembers.userId, userId)))
    .get();
}

export function listUserPartners(userId: string) {
  const memberships = db.select().from(schema.partnerMembers).where(eq(schema.partnerMembers.userId, userId)).all();
  if (!memberships.length) return [];
  const ids = memberships.map((m) => m.partnerId);
  const partners = db.select().from(schema.partners).where(inArray(schema.partners.id, ids)).all();
  return partners.map((p) => {
    const mem = memberships.find((m) => m.partnerId === p.id);
    return { ...serializePartner(p), memberRole: mem?.role || "editor" };
  });
}

export function campaignStats(campaignId: string) {
  const placements = db.select().from(schema.adPlacements).where(eq(schema.adPlacements.campaignId, campaignId)).all();
  const placementIds = placements.map((p) => p.id);
  if (!placementIds.length) return { impressions: 0, clicks: 0, ctr: 0 };

  const events = db
    .select()
    .from(schema.adEvents)
    .all()
    .filter((e) => placementIds.includes(e.placementId));

  const impressions = events.filter((e) => e.type === "impression").length;
  const clicks = events.filter((e) => e.type === "click").length;
  const ctr = impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0;
  return { impressions, clicks, ctr };
}
