export const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://altercosplay.vercel.app").replace(/\/$/, "");

export const BASE_HASHTAGS = ["#cosplay", "#костюм", "#реквизит", "#AlterCosPlay", "#handmade"] as const;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const GEMINI_MAX_PER_DAY = Number(process.env.GEMINI_MAX_PER_DAY || 200);
export const GEMINI_MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS || 8000);

export const YOUTUBE_DAILY_UPLOAD_CAP = Number(process.env.YOUTUBE_DAILY_UPLOAD_CAP || 80);

/** TikTok Content Posting privacy enums */
export const TIKTOK_PRIVACY_SELF_ONLY = "SELF_ONLY";
export const TIKTOK_PRIVACY_PUBLIC = "PUBLIC_TO_EVERYONE";

/** Lead block for brand social posts — plain language, benefits only. */
export const ALTER_COSPLAY_PITCH_RU = [
  "✨ AlterCosPlay — площадка для косплееров, блогеров и мастеров.",
  "Бесплатно: рилсы, портфолио, заказы и рост аудитории в одном месте.",
  "Блогерам — витрина и продвижение. Продавцам — биржа работ и клиенты.",
  "Есть путь к партнёрству с брендом. Таких условий на обычных соцсетях нет.",
  `👉 https://altercosplay.vercel.app`,
].join("\n");

export function authorSpotlightBlock(opts: {
  username: string;
  bio?: string | null;
  socialLinks?: Record<string, string> | null;
}): string {
  const profileUrl = `${SITE_URL}/profile/${encodeURIComponent(opts.username)}`;
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━",
    `⭐ АВТОР НА ALTERCOSPLAY → ${profileUrl}`,
    "━━━━━━━━━━━━━━━━━━━━",
  ];
  const bio = (opts.bio || "").trim();
  if (bio) {
    lines.push("", "О себе:", bio.slice(0, 600));
  }
  const links = opts.socialLinks || {};
  const linkLines = Object.entries(links)
    .filter(([, url]) => Boolean(url && String(url).trim()))
    .map(([platform, url]) => `${platform}: ${String(url).trim()}`);
  if (linkLines.length) {
    lines.push("", "Соцсети автора:", ...linkLines);
  }
  return lines.join("\n");
}

/** @deprecated use authorSpotlightBlock + ALTER_COSPLAY_PITCH_RU */
export const SOCIAL_FOOTER_RU = (username: string) =>
  authorSpotlightBlock({ username });

export const REJECT_NOTIFY_TEXT =
  "Этот материал останется на AlterCosPlay, но не уйдёт в соцсети бренда — тематика должна быть про косплей, костюмы или процесс.";

export const SOCIAL_SETTINGS_KEY = "social_settings";

export type SocialSettings = {
  tiktokAuditApproved: boolean;
  metaLiveMode: boolean;
  youtubeDailyUploadCap: number;
  /** Auto-publish to YouTube Shorts after moderation (default on). */
  publishYoutube: boolean;
  /** Auto-publish to TikTok (off until explicitly enabled). */
  publishTiktok: boolean;
  publishInstagram: boolean;
  publishFacebook: boolean;
};

export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  tiktokAuditApproved: false,
  metaLiveMode: false,
  youtubeDailyUploadCap: YOUTUBE_DAILY_UPLOAD_CAP,
  publishYoutube: true,
  publishTiktok: false,
  publishInstagram: false,
  publishFacebook: false,
};

export function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function geminiQuotaKey(day = utcDayKey()) {
  return `social_quota:gemini:${day}`;
}

export function youtubeUploadQuotaKey(day = utcDayKey()) {
  return `social_quota:youtube_uploads:${day}`;
}

export function nextUtcDayDeferDate(from = new Date()) {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 5, 0));
  return next;
}
