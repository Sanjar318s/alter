import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "../../db";
import { notify } from "../notify";
import { evaluateAllBloggers } from "../premium/evaluateBloggerV1";
import { REJECT_NOTIFY_TEXT, TIKTOK_PRIVACY_PUBLIC } from "./constants";
import { buildDescription } from "./copy";
import { mapGeminiToModerationStatus, moderateWithGemini } from "./gemini";
import { pickMedia } from "./media";
import { publishFacebook, publishInstagram, syncFacebookCounts, syncInstagramCounts } from "./meta";
import {
  claimJob,
  completeJob,
  deferJob,
  enqueuePublishes,
  failJob,
  type SocialJobRow,
} from "./queue";
import {
  initTikTokPullFromUrl,
  resolveTikTokPrivacy,
  syncTikTokCounts,
  waitTikTokPublish,
} from "./tiktok";
import {
  SocialOauthMissingError,
  syncYoutubeViews,
  uploadYoutubeShort,
} from "./youtube";

function backoffMs(attempts: number) {
  if (attempts <= 1) return 15 * 60_000;
  if (attempts === 2) return 60 * 60_000;
  return 6 * 60 * 60_000;
}

function parseTagsJson(raw?: string | null): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseMediaJson(raw?: string | null): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function processModerate(job: SocialJobRow) {
  const mod = db
    .select()
    .from(schema.socialModeration)
    .where(
      and(
        eq(schema.socialModeration.contentType, job.contentType),
        eq(schema.socialModeration.contentId, job.contentId)
      )
    )
    .get();
  if (!mod) {
    completeJob(job.id);
    return;
  }
  if (mod.status !== "pending") {
    completeJob(job.id);
    return;
  }

  let text = "";
  let imageUrl: string | null = null;
  let isVideo = false;
  let userId = mod.userId;

  if (job.contentType === "publication") {
    const pub = db.select().from(schema.publications).where(eq(schema.publications.id, job.contentId)).get();
    if (!pub || pub.kind !== "post") {
      completeJob(job.id);
      return;
    }
    const media = pickMedia(parseMediaJson(pub.mediaJson));
    text = [pub.caption || "", ...(parseTagsJson(pub.tagsJson))].join("\n");
    isVideo = media.isVideo;
    imageUrl = media.coverUrl || (!media.isVideo ? media.primaryUrl : null);
    userId = pub.userId;
    if (isVideo && !imageUrl) {
      db.update(schema.socialModeration)
        .set({
          status: "review",
          reason: "video_without_cover",
          confidence: "low",
          updatedAt: new Date(),
        })
        .where(eq(schema.socialModeration.id, mod.id))
        .run();
      completeJob(job.id);
      return;
    }
  } else {
    const build = db.select().from(schema.builds).where(eq(schema.builds.id, job.contentId)).get();
    if (!build || build.hidden) {
      completeJob(job.id);
      return;
    }
    const photos = db
      .select()
      .from(schema.buildPhotos)
      .where(eq(schema.buildPhotos.buildId, build.id))
      .all()
      .map((p) => p.imageUrl)
      .filter(Boolean) as string[];
    const media = pickMedia(photos, build.coverImageUrl);
    text = [build.title, build.franchise, build.character, build.description].filter(Boolean).join("\n");
    isVideo = media.isVideo;
    imageUrl = media.coverUrl || media.primaryUrl;
    userId = build.userId;
  }

  const result = await moderateWithGemini({
    contentType: job.contentType as "publication" | "build",
    contentId: job.contentId,
    text,
    imageUrl,
    isVideo,
  });

  if (result.deferred) {
    deferJob(job.id, new Date(Date.now() + 60 * 60_000), result.deferReason);
    return;
  }

  const status = mapGeminiToModerationStatus(result);
  db.update(schema.socialModeration)
    .set({
      status,
      confidence: result.confidence,
      reason: result.reason,
      geminiModel: result.model,
      geminiRawJson: result.rawJson.slice(0, 8000),
      updatedAt: new Date(),
    })
    .where(eq(schema.socialModeration.id, mod.id))
    .run();

  if (status === "approved") {
    enqueuePublishes(job.contentType as "publication" | "build", job.contentId);
  } else if (status === "rejected") {
    notify(userId, "social_moderation_rejected", {
      text: REJECT_NOTIFY_TEXT,
      contentType: job.contentType,
      contentId: job.contentId,
    });
  }

  completeJob(job.id);
}

function authorStillOptedIn(userId: string) {
  const u = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  return u?.socialCrosspostOptIn !== 0;
}

async function processPublish(job: SocialJobRow) {
  const platform = job.platform;
  if (!platform) {
    failJob(job.id, "missing_platform");
    return;
  }

  const post = db
    .select()
    .from(schema.socialPosts)
    .where(
      and(
        eq(schema.socialPosts.contentType, job.contentType),
        eq(schema.socialPosts.contentId, job.contentId),
        eq(schema.socialPosts.platform, platform)
      )
    )
    .get();

  if (post?.externalId && (post.status === "published" || post.status === "private_pending_audit")) {
    completeJob(job.id);
    return;
  }

  try {
    if (job.contentType === "publication") {
      const pub = db.select().from(schema.publications).where(eq(schema.publications.id, job.contentId)).get();
      if (!pub) {
        completeJob(job.id);
        return;
      }
      if (!authorStillOptedIn(pub.userId)) {
        completeJob(job.id);
        return;
      }
      const author = db.select().from(schema.users).where(eq(schema.users.id, pub.userId)).get();
      const copy = buildDescription("publication", {
        caption: pub.caption,
        tags: parseTagsJson(pub.tagsJson),
        username: author?.username || "user",
      });
      const media = pickMedia(parseMediaJson(pub.mediaJson));
      const videoUrl = media.primaryUrl;
      if (!videoUrl) throw new Error("no_media");

      if (post) {
        db.update(schema.socialPosts)
          .set({
            status: "publishing",
            title: copy.title,
            description: copy.description,
            hashtagsJson: JSON.stringify(copy.hashtags),
            sourceMediaUrl: videoUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.socialPosts.id, post.id))
          .run();
      }

      if (platform === "youtube") {
        const up = await uploadYoutubeShort({
          videoUrl,
          title: copy.title,
          description: copy.description,
          tags: copy.hashtags,
        });
        db.update(schema.socialPosts)
          .set({
            status: "published",
            externalId: up.videoId,
            externalUrl: up.url,
            publishedAt: new Date(),
            error: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.socialPosts.contentType, job.contentType),
              eq(schema.socialPosts.contentId, job.contentId),
              eq(schema.socialPosts.platform, "youtube")
            )
          )
          .run();
      } else if (platform === "tiktok") {
        const { visibility } = resolveTikTokPrivacy();
        const init = await initTikTokPullFromUrl({ videoUrl, title: copy.title });
        try {
          await waitTikTokPublish(init.publishId);
        } catch (e) {
          // status may still complete later; keep publish_id
          console.log("[social] tiktok wait", e instanceof Error ? e.message : e);
        }
        db.update(schema.socialPosts)
          .set({
            status: visibility === "public" ? "published" : "private_pending_audit",
            tiktokVisibility: visibility,
            externalId: init.publishId,
            sourceMediaUrl: videoUrl,
            publishedAt: new Date(),
            error: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.socialPosts.contentType, job.contentType),
              eq(schema.socialPosts.contentId, job.contentId),
              eq(schema.socialPosts.platform, "tiktok")
            )
          )
          .run();
      } else {
        failJob(job.id, `unsupported_platform:${platform}`);
        return;
      }
    } else {
      const build = db.select().from(schema.builds).where(eq(schema.builds.id, job.contentId)).get();
      if (!build || build.hidden) {
        completeJob(job.id);
        return;
      }
      if (!authorStillOptedIn(build.userId)) {
        completeJob(job.id);
        return;
      }
      const author = db.select().from(schema.users).where(eq(schema.users.id, build.userId)).get();
      const photos = db
        .select()
        .from(schema.buildPhotos)
        .where(eq(schema.buildPhotos.buildId, build.id))
        .all()
        .map((p) => p.imageUrl)
        .filter(Boolean) as string[];
      const media = pickMedia(photos, build.coverImageUrl);
      const mediaUrl = media.primaryUrl;
      if (!mediaUrl) throw new Error("no_media");
      const copy = buildDescription("build", {
        title: build.title,
        description: build.description,
        franchise: build.franchise,
        character: build.character,
        username: author?.username || "user",
        buildId: build.id,
      });

      if (post) {
        db.update(schema.socialPosts)
          .set({
            status: "publishing",
            title: copy.title,
            description: copy.description,
            hashtagsJson: JSON.stringify(copy.hashtags),
            sourceMediaUrl: mediaUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.socialPosts.id, post.id))
          .run();
      }

      if (platform === "instagram") {
        const up = await publishInstagram({ mediaUrl, caption: copy.description });
        db.update(schema.socialPosts)
          .set({
            status: "published",
            externalId: up.mediaId,
            externalUrl: up.permalink || null,
            publishedAt: new Date(),
            error: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.socialPosts.contentType, "build"),
              eq(schema.socialPosts.contentId, job.contentId),
              eq(schema.socialPosts.platform, "instagram")
            )
          )
          .run();
      } else if (platform === "facebook") {
        const up = await publishFacebook({ mediaUrl, caption: copy.description });
        db.update(schema.socialPosts)
          .set({
            status: "published",
            externalId: up.postId,
            externalUrl: up.url || null,
            publishedAt: new Date(),
            error: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.socialPosts.contentType, "build"),
              eq(schema.socialPosts.contentId, job.contentId),
              eq(schema.socialPosts.platform, "facebook")
            )
          )
          .run();
      } else {
        failJob(job.id, `unsupported_platform:${platform}`);
        return;
      }
    }

    completeJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof SocialOauthMissingError || message.startsWith("oauth_missing")) {
      deferJob(job.id, new Date(Date.now() + 60 * 60_000), message);
      return;
    }
    if (message === "youtube_daily_cap") {
      const deferUntil = (err as Error & { deferUntil?: Date }).deferUntil || new Date(Date.now() + 60 * 60_000);
      deferJob(job.id, deferUntil, message);
      return;
    }
    if (message === "not_video" || message === "no_media" || message === "too_large") {
      if (post) {
        db.update(schema.socialPosts)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(schema.socialPosts.id, post.id))
          .run();
      }
      failJob(job.id, message);
      return;
    }

    const attempts = job.attempts || 1;
    const max = job.maxAttempts || 5;
    if (attempts >= max) {
      if (post) {
        db.update(schema.socialPosts)
          .set({ status: "failed", error: message.slice(0, 2000), updatedAt: new Date() })
          .where(eq(schema.socialPosts.id, post.id))
          .run();
      }
      failJob(job.id, message);
    } else {
      deferJob(job.id, new Date(Date.now() + backoffMs(attempts)), message);
    }
  }
}

async function processTiktokRepost(job: SocialJobRow) {
  const post = db
    .select()
    .from(schema.socialPosts)
    .where(
      and(
        eq(schema.socialPosts.contentType, "publication"),
        eq(schema.socialPosts.contentId, job.contentId),
        eq(schema.socialPosts.platform, "tiktok")
      )
    )
    .get();
  if (!post?.sourceMediaUrl) {
    failJob(job.id, "missing_source_media");
    return;
  }
  if (post.tiktokVisibility === "public" && post.status === "published") {
    completeJob(job.id);
    return;
  }

  try {
    const init = await initTikTokPullFromUrl({
      videoUrl: post.sourceMediaUrl,
      title: post.title || "Cosplay",
      privacyLevel: TIKTOK_PRIVACY_PUBLIC,
    });
    try {
      await waitTikTokPublish(init.publishId);
    } catch {
      /* keep id */
    }
    db.update(schema.socialPosts)
      .set({
        tiktokLegacyPublishId: post.externalId,
        externalId: init.publishId,
        tiktokVisibility: "public",
        status: "published",
        updatedAt: new Date(),
        publishedAt: new Date(),
        error: null,
      })
      .where(eq(schema.socialPosts.id, post.id))
      .run();
    completeJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof SocialOauthMissingError || message.startsWith("oauth_missing")) {
      deferJob(job.id, new Date(Date.now() + 60 * 60_000), message);
      return;
    }
    deferJob(job.id, new Date(Date.now() + backoffMs(job.attempts || 1)), message);
  }
}

export async function syncSocialPosts(limit = 20) {
  const cutoff = new Date(Date.now() - 6 * 60 * 60_000);
  const rows = db
    .select()
    .from(schema.socialPosts)
    .where(
      and(
        inArray(schema.socialPosts.status, ["published", "private_pending_audit"]),
        or(isNull(schema.socialPosts.lastSyncedAt), lt(schema.socialPosts.lastSyncedAt, cutoff))
      )
    )
    .limit(limit)
    .all();

  for (const row of rows) {
    if (!row.externalId) continue;
    try {
      let likes = row.likesCount || 0;
      let comments = row.commentsCount || 0;
      let views = row.viewsCount || 0;
      if (row.platform === "youtube") {
        const s = await syncYoutubeViews(row.externalId);
        likes = s.likes;
        comments = s.comments;
        views = s.views;
      } else if (row.platform === "instagram") {
        const s = await syncInstagramCounts(row.externalId);
        likes = s.likes;
        comments = s.comments;
      } else if (row.platform === "facebook") {
        const s = await syncFacebookCounts(row.externalId);
        likes = s.likes;
        comments = s.comments;
      } else if (row.platform === "tiktok") {
        const s = await syncTikTokCounts(row.externalId);
        likes = s.likes;
        comments = s.comments;
      }
      db.update(schema.socialPosts)
        .set({
          likesCount: likes,
          commentsCount: comments,
          viewsCount: views,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.socialPosts.id, row.id))
        .run();
    } catch (err) {
      console.log("[social] sync fail", row.platform, row.externalId, err instanceof Error ? err.message : err);
    }
  }
  return rows.length;
}

let lastBloggerEvalAt = 0;

export async function processOneJob(): Promise<boolean> {
  const job = claimJob();
  if (!job) return false;

  try {
    if (job.kind === "moderate") await processModerate(job);
    else if (job.kind === "publish") await processPublish(job);
    else if (job.kind === "tiktok_public_repost") await processTiktokRepost(job);
    else completeJob(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[social] job crash", job.id, message);
    deferJob(job.id, new Date(Date.now() + backoffMs(job.attempts || 1)), message);
  }

  if (Date.now() - lastBloggerEvalAt > 6 * 60 * 60_000) {
    lastBloggerEvalAt = Date.now();
    try {
      const r = evaluateAllBloggers();
      console.log("[social] evaluateAllBloggers", r);
    } catch (e) {
      console.log("[social] evaluateAllBloggers fail", e instanceof Error ? e.message : e);
    }
  }

  return true;
}
