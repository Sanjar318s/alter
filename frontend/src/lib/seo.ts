import type { Metadata } from "next";

export const SITE_NAME = "AlterCosPlay";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://altercosplay.vercel.app";

export const API_ORIGIN =
  process.env.ALTER_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000";

/** Default OG/Twitter image. Upload `frontend/public/og-preview.png` (1200×630) when ready. */
export const OG_IMAGE_PATH = "/og-preview.png";

export const SEO_KEYWORDS = [
  "AlterCosPlay",
  "платформа для косплееров",
  "заказать костюм косплей",
  "фриланс мастера косплея",
  "коммишен косплей",
  "портфолио косплея",
  "мастер костюмов косплей",
  "биржа услуг косплей",
];

export function pageMetadata(input: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
  keywords?: string[];
  /** When true, skip the root `%s | AlterCosPlay` template (title already includes brand). */
  absoluteTitle?: boolean;
  image?: string | null;
}): Metadata {
  const {
    title,
    description,
    path,
    noIndex = false,
    keywords = SEO_KEYWORDS,
    absoluteTitle = false,
    image,
  } = input;
  const url = path ? `${SITE_URL}${path}` : SITE_URL;
  // null = explicitly no image; undefined = default OG asset
  const ogImage = image === null ? undefined : image || OG_IMAGE_PATH;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: path ? { canonical: path } : { canonical: "/" },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export async function fetchPublicJson<T>(
  path: string,
  revalidate = 3600
): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      "Биржа готовых работ, рилсы и соцсеть для косплееров, продавцов и блогеров.",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "ru-RU",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/explore?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function personJsonLd(input: {
  name: string;
  username: string;
  description?: string;
  image?: string | null;
}) {
  const url = `${SITE_URL}/profile/${encodeURIComponent(input.username)}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      name: input.name,
      alternateName: `@${input.username}`,
      url,
      description: input.description || undefined,
      image: input.image || undefined,
      jobTitle: "Косплеер",
    },
  };
}

export function creativeWorkJsonLd(input: {
  name: string;
  description?: string;
  url: string;
  image?: string | null;
  authorName?: string;
  authorUrl?: string;
  dateModified?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: input.name,
    description: input.description || undefined,
    url: input.url,
    image: input.image || undefined,
    dateModified: input.dateModified || undefined,
    author: input.authorName
      ? {
          "@type": "Person",
          name: input.authorName,
          url: input.authorUrl,
        }
      : undefined,
  };
}

export function serviceJsonLd(input: {
  name: string;
  description: string;
  url: string;
  providerName: string;
  providerUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: input.url,
    provider: {
      "@type": "Person",
      name: input.providerName,
      url: input.providerUrl,
    },
    areaServed: "Worldwide",
    serviceType: "Cosplay commission",
  };
}
