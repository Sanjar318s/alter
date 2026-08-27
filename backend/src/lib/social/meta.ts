import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { isLikelyVideoUrl } from "./media";
import { loadSocialSettings, SocialOauthMissingError } from "./youtube";

type MetaExtra = { pageId?: string; igUserId?: string };

function getMetaToken() {
  const row = db
    .select()
    .from(schema.socialOauthTokens)
    .where(eq(schema.socialOauthTokens.provider, "meta"))
    .get();
  if (!row?.accessToken) throw new SocialOauthMissingError("meta");
  let extra: MetaExtra = {};
  try {
    extra = row.extraJson ? JSON.parse(row.extraJson) : {};
  } catch {
    extra = {};
  }
  return {
    accessToken: row.accessToken,
    pageId: process.env.META_PAGE_ID || extra.pageId,
    igUserId: process.env.META_IG_USER_ID || extra.igUserId,
  };
}

async function pollIgContainer(creationId: string, token: string, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as { status_code?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || `ig_status_${res.status}`);
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("ig_container_error");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("ig_container_timeout");
}

export async function publishInstagram(opts: {
  mediaUrl: string;
  caption: string;
}): Promise<{ mediaId: string; permalink?: string }> {
  const { accessToken, igUserId } = getMetaToken();
  if (!igUserId) throw new SocialOauthMissingError("meta");

  const isVideo = isLikelyVideoUrl(opts.mediaUrl);
  const params = new URLSearchParams({
    access_token: accessToken,
    caption: opts.caption.slice(0, 2200),
  });
  if (isVideo) {
    params.set("media_type", "REELS");
    params.set("video_url", opts.mediaUrl);
    params.set("share_to_feed", "true");
  } else {
    params.set("image_url", opts.mediaUrl);
  }

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id) {
    throw new Error(created.error?.message || `ig_media_${createRes.status}`);
  }

  await pollIgContainer(created.id, accessToken);

  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: created.id, access_token: accessToken }),
  });
  const published = (await pubRes.json()) as { id?: string; error?: { message?: string } };
  if (!pubRes.ok || !published.id) {
    throw new Error(published.error?.message || `ig_publish_${pubRes.status}`);
  }

  let permalink: string | undefined;
  try {
    const pl = await fetch(
      `https://graph.facebook.com/v21.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    const plData = (await pl.json()) as { permalink?: string };
    permalink = plData.permalink;
  } catch {
    /* optional */
  }

  const settings = loadSocialSettings();
  if (!settings.metaLiveMode) {
    console.log("[social] meta Development mode — post visible to testers only", { mediaId: published.id });
  }

  return { mediaId: published.id, permalink };
}

export async function publishFacebook(opts: {
  mediaUrl: string;
  caption: string;
}): Promise<{ postId: string; url?: string }> {
  const { accessToken, pageId } = getMetaToken();
  if (!pageId) throw new SocialOauthMissingError("meta");

  const isVideo = isLikelyVideoUrl(opts.mediaUrl);
  const endpoint = isVideo
    ? `https://graph.facebook.com/v21.0/${pageId}/videos`
    : `https://graph.facebook.com/v21.0/${pageId}/photos`;

  const body = new URLSearchParams({ access_token: accessToken });
  if (isVideo) {
    body.set("file_url", opts.mediaUrl);
    body.set("description", opts.caption.slice(0, 2200));
  } else {
    body.set("url", opts.mediaUrl);
    body.set("caption", opts.caption.slice(0, 2200));
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `fb_publish_${res.status}`);
  const postId = data.post_id || data.id;
  if (!postId) throw new Error("fb_empty_id");
  return { postId, url: `https://facebook.com/${postId}` };
}

export async function syncInstagramCounts(mediaId: string): Promise<{ likes: number; comments: number }> {
  const { accessToken } = getMetaToken();
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}?fields=like_count,comments_count&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) throw new Error(`ig_sync_${res.status}`);
  const data = (await res.json()) as { like_count?: number; comments_count?: number };
  return { likes: Number(data.like_count || 0), comments: Number(data.comments_count || 0) };
}

export async function syncFacebookCounts(postId: string): Promise<{ likes: number; comments: number }> {
  const { accessToken } = getMetaToken();
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${postId}?fields=reactions.summary(true),comments.summary(true)&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) throw new Error(`fb_sync_${res.status}`);
  const data = (await res.json()) as {
    reactions?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
  };
  return {
    likes: Number(data.reactions?.summary?.total_count || 0),
    comments: Number(data.comments?.summary?.total_count || 0),
  };
}
