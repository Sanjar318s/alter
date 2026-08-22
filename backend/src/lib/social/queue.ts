import { and, eq, inArray, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../../db";

export type SocialContentType = "publication" | "build";

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

  const activeStatuses = ["queued", "running", "deferred"];
  const activeJob = db
    .select({ id: schema.socialJobs.id })
    .from(schema.socialJobs)
    .where(
      and(
        eq(schema.socialJobs.kind, "moderate"),
        isNull(schema.socialJobs.platform),
        eq(schema.socialJobs.contentType, contentType),
        eq(schema.socialJobs.contentId, contentId),
        inArray(schema.socialJobs.status, activeStatuses)
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
