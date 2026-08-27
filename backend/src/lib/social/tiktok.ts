import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import {
  TIKTOK_PRIVACY_PUBLIC,
  TIKTOK_PRIVACY_SELF_ONLY,
} from "./constants";
import { loadSocialSettings, SocialOauthMissingError } from "./youtube";

type TikTokExtra = { openId?: string };

function getTikTokToken() {
  const row = db
    .select()
    .from(schema.socialOauthTokens)
    .where(eq(schema.socialOauthTokens.provider, "tiktok"))
    .get();
  if (!row?.accessToken) throw new SocialOauthMissingError("tiktok");
  let extra: TikTokExtra = {};
  try {
    extra = row.extraJson ? JSON.parse(row.extraJson) : {};
  } catch {
    extra = {};
  }
  return { accessToken: row.accessToken, openId: extra.openId };
}

export function resolveTikTokPrivacy(): { privacy: string; visibility: "private_pending_audit" | "public" } {
  const settings = loadSocialSettings();
  if (settings.tiktokAuditApproved) {
    return { privacy: TIKTOK_PRIVACY_PUBLIC, visibility: "public" };
  }
  return { privacy: TIKTOK_PRIVACY_SELF_ONLY, visibility: "private_pending_audit" };
}

export async function initTikTokPullFromUrl(opts: {
  videoUrl: string;
  title: string;
  privacyLevel?: string;
}): Promise<{ publishId: string }> {
  const { accessToken } = getTikTokToken();
  const { privacy } = resolveTikTokPrivacy();
  const privacyLevel = opts.privacyLevel || privacy;

  const endpoint =
    privacyLevel === TIKTOK_PRIVACY_SELF_ONLY
      ? "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
      : "https://open.tiktokapis.com/v2/post/publish/video/init/";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: opts.title.slice(0, 150),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: opts.videoUrl,
      },
    }),
  });

  const data = (await res.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || !data.data?.publish_id) {
    throw new Error(data.error?.message || data.error?.code || `tiktok_init_${res.status}`);
  }
  return { publishId: data.data.publish_id };
}

export async function fetchTikTokPublishStatus(publishId: string): Promise<{
  status: string;
  failReason?: string;
}> {
  const { accessToken } = getTikTokToken();
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const data = (await res.json()) as {
    data?: { status?: string; fail_reason?: string };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || `tiktok_status_${res.status}`);
  return { status: data.data?.status || "UNKNOWN", failReason: data.data?.fail_reason };
}

export async function waitTikTokPublish(publishId: string, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const st = await fetchTikTokPublishStatus(publishId);
    if (st.status === "PUBLISH_COMPLETE") return st;
    if (st.status === "FAILED") throw new Error(st.failReason || "tiktok_failed");
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("tiktok_status_timeout");
}

export async function syncTikTokCounts(_videoId: string): Promise<{ likes: number; comments: number }> {
  // SELF_ONLY often returns empty stats — treat as zero, not an error.
  try {
    const { accessToken } = getTikTokToken();
    const res = await fetch("https://open.tiktokapis.com/v2/video/query/?fields=like_count,comment_count", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { video_ids: [_videoId] } }),
    });
    if (!res.ok) return { likes: 0, comments: 0 };
    const data = (await res.json()) as {
      data?: { videos?: Array<{ like_count?: number; comment_count?: number }> };
    };
    const v = data.data?.videos?.[0];
    return { likes: Number(v?.like_count || 0), comments: Number(v?.comment_count || 0) };
  } catch {
    return { likes: 0, comments: 0 };
  }
}
