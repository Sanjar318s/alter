import { eq } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import { db, schema } from "../../db";
import {
  YOUTUBE_DAILY_UPLOAD_CAP,
  nextUtcDayDeferDate,
  youtubeUploadQuotaKey,
  DEFAULT_SOCIAL_SETTINGS,
  SOCIAL_SETTINGS_KEY,
  type SocialSettings,
} from "./constants";
import { fetchBuffer, isLikelyVideoUrl } from "./media";

function getKv(key: string): string | null {
  return db.select().from(schema.appKv).where(eq(schema.appKv.key, key)).get()?.value ?? null;
}

function setKv(key: string, value: string) {
  const existing = db.select().from(schema.appKv).where(eq(schema.appKv.key, key)).get();
  if (existing) {
    db.update(schema.appKv).set({ value, updatedAt: new Date() }).where(eq(schema.appKv.key, key)).run();
  } else {
    db.insert(schema.appKv).values({ key, value, updatedAt: new Date() }).run();
  }
}

export function loadSocialSettings(): SocialSettings {
  try {
    const raw = getKv(SOCIAL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SOCIAL_SETTINGS };
    return { ...DEFAULT_SOCIAL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SOCIAL_SETTINGS };
  }
}

export function saveSocialSettings(patch: Partial<SocialSettings>) {
  const next = { ...loadSocialSettings(), ...patch };
  setKv(SOCIAL_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getYoutubeUploadCount(): number {
  return Number(getKv(youtubeUploadQuotaKey()) || 0);
}

export function incrementYoutubeUploadCount(): number {
  const key = youtubeUploadQuotaKey();
  const next = getYoutubeUploadCount() + 1;
  setKv(key, String(next));
  return next;
}

export class SocialOauthMissingError extends Error {
  code = "oauth_missing";
  constructor(provider: string) {
    super(`oauth_missing:${provider}`);
    this.name = "SocialOauthMissingError";
  }
}

export async function getYoutubeAccessToken(): Promise<string> {
  const row = db
    .select()
    .from(schema.socialOauthTokens)
    .where(eq(schema.socialOauthTokens.provider, "youtube"))
    .get();
  if (!row?.accessToken && !row?.refreshToken) throw new SocialOauthMissingError("youtube");

  const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
  if (row.accessToken && expiresAt > Date.now() + 60_000) return row.accessToken;

  if (!row.refreshToken) throw new SocialOauthMissingError("youtube");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new SocialOauthMissingError("youtube");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "youtube_refresh_failed");
  }
  const expires = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  db.update(schema.socialOauthTokens)
    .set({ accessToken: data.access_token, expiresAt: expires, updatedAt: new Date() })
    .where(eq(schema.socialOauthTokens.provider, "youtube"))
    .run();
  return data.access_token;
}

export async function uploadYoutubeShort(opts: {
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}): Promise<{ videoId: string; url: string }> {
  if (!isLikelyVideoUrl(opts.videoUrl) && !opts.videoUrl.match(/\.(mp4|webm|mov)(\?|$)/i)) {
    // still try if content-type says video after HEAD — but fail fast for obvious images
    if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(opts.videoUrl)) {
      throw new Error("not_video");
    }
  }

  const settings = loadSocialSettings();
  const cap = settings.youtubeDailyUploadCap || YOUTUBE_DAILY_UPLOAD_CAP;
  if (getYoutubeUploadCount() >= cap) {
    const err = new Error("youtube_daily_cap");
    (err as Error & { deferUntil?: Date }).deferUntil = nextUtcDayDeferDate();
    throw err;
  }

  const token = await getYoutubeAccessToken();
  const { buffer, mime } = await fetchBuffer(opts.videoUrl);
  if (!mime.startsWith("video/") && !isLikelyVideoUrl(opts.videoUrl)) {
    throw new Error("not_video");
  }

  const tmp = path.join(os.tmpdir(), `alter-yt-${Date.now()}.mp4`);
  fs.writeFileSync(tmp, buffer);

  try {
    const metaRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mime.startsWith("video/") ? mime : "video/mp4",
          "X-Upload-Content-Length": String(buffer.length),
        },
        body: JSON.stringify({
          snippet: {
            title: opts.title.slice(0, 100),
            description: opts.description.slice(0, 5000),
            tags: opts.tags.map((t) => t.replace(/^#/, "")).slice(0, 15),
            categoryId: "24",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!metaRes.ok) {
      const t = await metaRes.text();
      throw new Error(`youtube_init_${metaRes.status}:${t.slice(0, 300)}`);
    }

    const uploadUrl = metaRes.headers.get("location");
    if (!uploadUrl) throw new Error("youtube_no_upload_url");

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mime.startsWith("video/") ? mime : "video/mp4",
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    });

    const putBody = await putRes.text();
    if (!putRes.ok) {
      throw new Error(`youtube_upload_${putRes.status}:${putBody.slice(0, 300)}`);
    }

    let videoId = "";
    try {
      videoId = (JSON.parse(putBody) as { id?: string }).id || "";
    } catch {
      throw new Error("youtube_parse_id");
    }
    if (!videoId) throw new Error("youtube_empty_id");

    incrementYoutubeUploadCount();
    return { videoId, url: `https://youtube.com/shorts/${videoId}` };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export async function syncYoutubeViews(externalId: string): Promise<{
  likes: number;
  comments: number;
  views: number;
}> {
  const token = await getYoutubeAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(externalId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`youtube_stats_${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{ statistics?: { likeCount?: string; commentCount?: string; viewCount?: string } }>;
  };
  const stats = data.items?.[0]?.statistics || {};
  return {
    likes: Number(stats.likeCount || 0),
    comments: Number(stats.commentCount || 0),
    views: Number(stats.viewCount || 0),
  };
}
