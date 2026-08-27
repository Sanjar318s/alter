export const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://altercosplay.vercel.app").replace(/\/$/, "");

export const BASE_HASHTAGS = ["#cosplay", "#костюм", "#реквизит", "#AlterCosPlay", "#handmade"] as const;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const GEMINI_MAX_PER_DAY = Number(process.env.GEMINI_MAX_PER_DAY || 200);
export const GEMINI_MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS || 8000);

export const YOUTUBE_DAILY_UPLOAD_CAP = Number(process.env.YOUTUBE_DAILY_UPLOAD_CAP || 5);

/** TikTok Content Posting privacy enums */
export const TIKTOK_PRIVACY_SELF_ONLY = "SELF_ONLY";
export const TIKTOK_PRIVACY_PUBLIC = "PUBLIC_TO_EVERYONE";

export const SOCIAL_FOOTER_RU = (username: string) =>
  [
    `Автор: @${username}`,
    `Профиль: ${SITE_URL}/profile/${username}`,
    "Смотрите больше на AlterCosPlay и подписывайтесь на канал AlterCosPlay.",
  ].join("\n");

export const REJECT_NOTIFY_TEXT =
  "Этот материал останется на AlterCosPlay, но не уйдёт в соцсети бренда — тематика должна быть про косплей, костюмы или процесс.";

export const SOCIAL_SETTINGS_KEY = "social_settings";

export type SocialSettings = {
  tiktokAuditApproved: boolean;
  metaLiveMode: boolean;
  youtubeDailyUploadCap: number;
};

export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  tiktokAuditApproved: false,
  metaLiveMode: false,
  youtubeDailyUploadCap: YOUTUBE_DAILY_UPLOAD_CAP,
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
