import type { Metadata } from "next";

export const SITE_NAME = "ALTER";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://alter-black.vercel.app";

export const API_ORIGIN =
  process.env.ALTER_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000";

export const SEO_KEYWORDS = [
  "платформа для косплееров",
  "заказать костюм косплей",
  "фриланс мастера косплея",
  "коммишен косплей",
  "портфолио косплея",
  "мастер костюмов косплей",
  "ALTER",
];

export function pageMetadata(input: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
  keywords?: string[];
}): Metadata {
  const { title, description, path, noIndex = false, keywords = SEO_KEYWORDS } = input;
  const url = path ? `${SITE_URL}${path}` : SITE_URL;

  return {
    title,
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
