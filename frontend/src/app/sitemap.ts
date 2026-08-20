import type { MetadataRoute } from "next";
import { SITE_URL, fetchPublicJson } from "@/lib/seo";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/explore`, changeFrequency: "hourly", priority: 0.9 },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/contacts`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/rules`, changeFrequency: "yearly", priority: 0.4 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.4 },
  { url: `${SITE_URL}/partners`, changeFrequency: "weekly", priority: 0.7 },
];

type BuildRow = { id: string; updatedAt?: string | null };
type PartnerRow = { slug: string; updatedAt?: string | null };
type EventRow = { slug: string; startsAt?: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [buildsData, partnersData, eventsData] = await Promise.all([
    fetchPublicJson<{ builds?: BuildRow[] }>("/api/builds"),
    fetchPublicJson<{ partners?: PartnerRow[] }>("/api/partners"),
    fetchPublicJson<{ events?: EventRow[] }>("/api/partners/events"),
  ]);

  const builds = (buildsData?.builds ?? []).map((b) => ({
    url: `${SITE_URL}/build/${b.id}`,
    lastModified: b.updatedAt ? new Date(b.updatedAt) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const partners = (partnersData?.partners ?? []).map((p) => ({
    url: `${SITE_URL}/partners/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const events = (eventsData?.events ?? []).map((e) => ({
    url: `${SITE_URL}/events/${e.slug}`,
    lastModified: e.startsAt ? new Date(e.startsAt) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  return [...STATIC_ROUTES, ...builds, ...partners, ...events];
}
