import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../../db";

export type SocialContentType = "publication" | "build";
export type SocialPlatform = "youtube" | "instagram" | "facebook" | "tiktok";

const ACTIVE_JOB_STATUSES = ["queued", "running", "deferred"] as const;

/**
 * Creates the pending moderation row + queued `moderate` job for a content item.
 * No external calls here — the worker picks the job up later.
 */
export function enqueueSocialModeration(contentType: SocialContentType, contentId: string, userId: string) {
  const existingModeration = db
    .select({ id: schema.socialModeration.id })
    .from(schema.socialModeration)
    .where(
      and(eq(schema.socialModeration.contentType, contentType), eq(schema.socialModeration.contentId, contentId))
    )
    .get();
  if (existingModeration) return;

  const activeJob = db
    .select({ id: schema.socialJobs.id })
    .from(schema.socialJobs)
    .where(
      and(
        eq(schema.socialJobs.kind, "moderate"),
        isNull(schema.socialJobs.platform),
        eq(schema.socialJobs.contentType, contentType),
        eq(schema.socialJobs.contentId, contentId),
        inArray(schema.socialJobs.status, [...ACTIVE_JOB_STATUSES])
      )
    )
    .get();

  if (!activeJob) {
    db.insert(schema.socialJobs)
      .values({
        id: uuid(),
        kind: "moderate",
        platform: null,
        contentType,
        contentId,
        status: "queued",
      })
      .run();
  }

  db.insert(schema.socialModeration)
    .values({
      id: uuid(),
      contentType,
      contentId,
      userId,
      status: "pending",
    })
    .run();
}

function enqueuePublishJob(platform: SocialPlatform, contentType: SocialContentType, contentId: string) {
  const active = db
    .select({ id: schema.socialJobs.id })
    .from(schema.socialJobs)
    .where(
      and(
        eq(schema.socialJobs.kind, "publish"),
        eq(schema.socialJobs.platform, platform),
        eq(schema.socialJobs.contentType, contentType),
        eq(schema.socialJobs.contentId, contentId),
        inArray(schema.socialJobs.status, [...ACTIVE_JOB_STATUSES])
      )
    )
    .get();
  if (active) return;

  const published = db
    .select({ id: schema.socialPosts.id, externalId: schema.socialPosts.externalId, status: schema.socialPosts.status })
    .from(schema.socialPosts)
    .where(
      and(
        eq(schema.socialPosts.contentType, contentType),
        eq(schema.socialPosts.contentId, contentId),
        eq(schema.socialPosts.platform, platform)
      )
    )
    .get();
  if (published?.externalId && (published.status === "published" || published.status === "private_pending_audit")) {
    return;
  }

  if (!published) {
    db.insert(schema.socialPosts)
      .values({
        id: uuid(),
        contentType,
        contentId,
        platform,
        status: "queued",
      })
      .run();
  } else if (published.status === "failed") {
    db.update(schema.socialPosts)
      .set({ status: "queued", error: null, updatedAt: new Date() })
      .where(eq(schema.socialPosts.id, published.id))
      .run();
  }

  db.insert(schema.socialJobs)
    .values({
      id: uuid(),
      kind: "publish",
      platform,
      contentType,
      contentId,
      status: "queued",
    })
    .run();
}

/** After moderation approved: route content to brand platforms and ensure social_posts rows. */
export function enqueuePublishes(contentType: SocialContentType, contentId: string) {
  if (contentType === "publication") {
    enqueuePublishJob("youtube", contentType, contentId);
    enqueuePublishJob("tiktok", contentType, contentId);
  } else if (contentType === "build") {
    enqueuePublishJob("instagram", contentType, contentId);
    enqueuePublishJob("facebook", contentType, contentId);
  }
}

export function enqueueTiktokPublicRepost(contentId: string) {
  const active = db
    .select({ id: schema.socialJobs.id })
    .from(schema.socialJobs)
    .where(
      and(
        eq(schema.socialJobs.kind, "tiktok_public_repost"),
        eq(schema.socialJobs.platform, "tiktok"),
        eq(schema.socialJobs.contentType, "publication"),
        eq(schema.socialJobs.contentId, contentId),
        inArray(schema.socialJobs.status, [...ACTIVE_JOB_STATUSES])
      )
    )
    .get();
  if (active) return;
  db.insert(schema.socialJobs)
    .values({
      id: uuid(),
      kind: "tiktok_public_repost",
      platform: "tiktok",
      contentType: "publication",
      contentId,
      status: "queued",
    })
    .run();
}

export type SocialJobRow = typeof schema.socialJobs.$inferSelect;

/** Optimistic claim of one runnable job. */
export function claimJob(): SocialJobRow | null {
  const now = new Date();
  const candidate = db
    .select()
    .from(schema.socialJobs)
    .where(
      and(
        inArray(schema.socialJobs.status, ["queued", "deferred"]),
        lte(schema.socialJobs.runAfter, now),
        sql`COALESCE(${schema.socialJobs.attempts}, 0) < COALESCE(${schema.socialJobs.maxAttempts}, 5)`
      )
    )
    .orderBy(asc(schema.socialJobs.createdAt))
    .limit(1)
    .get();

  if (!candidate) return null;

  const result = db
    .update(schema.socialJobs)
    .set({
      status: "running",
      lockedAt: now,
      attempts: (candidate.attempts || 0) + 1,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.socialJobs.id, candidate.id),
        inArray(schema.socialJobs.status, ["queued", "deferred"])
      )
    )
    .run();

  if (!result.changes) return null;

  return db.select().from(schema.socialJobs).where(eq(schema.socialJobs.id, candidate.id)).get() || null;
}

export function completeJob(jobId: string) {
  db.update(schema.socialJobs)
    .set({ status: "done", lastError: null, lockedAt: null, updatedAt: new Date() })
    .where(eq(schema.socialJobs.id, jobId))
    .run();
}

export function failJob(jobId: string, error: string) {
  db.update(schema.socialJobs)
    .set({ status: "failed", lastError: error.slice(0, 2000), lockedAt: null, updatedAt: new Date() })
    .where(eq(schema.socialJobs.id, jobId))
    .run();
}

export function deferJob(jobId: string, runAfter: Date, error?: string) {
  db.update(schema.socialJobs)
    .set({
      status: "deferred",
      runAfter,
      lastError: error ? error.slice(0, 2000) : null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.socialJobs.id, jobId))
    .run();
}

export function loadSocialAggregate(contentType: SocialContentType, contentIds: string[]) {
  if (!contentIds.length) return new Map<string, ReturnType<typeof shapeSocial>>();

  const mods = db
    .select()
    .from(schema.socialModeration)
    .where(
      and(eq(schema.socialModeration.contentType, contentType), inArray(schema.socialModeration.contentId, contentIds))
    )
    .all();
  const posts = db
    .select()
    .from(schema.socialPosts)
    .where(and(eq(schema.socialPosts.contentType, contentType), inArray(schema.socialPosts.contentId, contentIds)))
    .all();

  const byId = new Map<string, ReturnType<typeof shapeSocial>>();
  for (const id of contentIds) {
    const mod = mods.find((m) => m.contentId === id);
    const itemPosts = posts.filter((p) => p.contentId === id);
    byId.set(id, shapeSocial(mod?.status || null, itemPosts));
  }
  return byId;
}

function shapeSocial(
  moderationStatus: string | null,
  posts: (typeof schema.socialPosts.$inferSelect)[]
) {
  const mapped = posts.map((p) => ({
    platform: p.platform,
    status: p.status,
    url: p.externalUrl,
    likesCount: p.likesCount || 0,
    commentsCount: p.commentsCount || 0,
    viewsCount: p.viewsCount || 0,
    tiktokVisibility: p.tiktokVisibility,
    lastSyncedAt: p.lastSyncedAt,
  }));
  const totals = mapped.reduce(
    (acc, p) => {
      if (p.status === "published" || p.status === "private_pending_audit") {
        acc.likes += p.likesCount;
        acc.comments += p.commentsCount;
        acc.views += p.viewsCount;
      }
      return acc;
    },
    { likes: 0, comments: 0, views: 0 }
  );
  return { moderationStatus, posts: mapped, totals };
}
