import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../../db";

export const BLOGGER_V1 = "blogger_v1";
const YT_VIEWS_PER_REEL = 1_000_000;
const YT_REELS_NEEDED = 5;
const PLATFORM_VIEWS_NEEDED = 10_000;
const PLATFORM_COMMENTS_NEEDED = 10_000;
const GRANT_DAYS = 365;

export type BloggerPremiumProgress = {
  ruleSet: typeof BLOGGER_V1;
  youtubeReelsAt1M: number;
  youtubeReelsNeeded: number;
  platformViews: number;
  platformViewsNeeded: number;
  platformComments: number;
  platformCommentsNeeded: number;
  qualifies: boolean;
  activeGrant: {
    id: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

function expireOldGrants(userId: string) {
  const now = new Date();
  const active = db
    .select()
    .from(schema.premiumGrants)
    .where(
      and(
        eq(schema.premiumGrants.userId, userId),
        eq(schema.premiumGrants.ruleSet, BLOGGER_V1),
        eq(schema.premiumGrants.status, "active")
      )
    )
    .all();
  for (const g of active) {
    if (new Date(g.endsAt as Date).getTime() <= now.getTime()) {
      db.update(schema.premiumGrants)
        .set({ status: "expired" })
        .where(eq(schema.premiumGrants.id, g.id))
        .run();
    }
  }
}

export function getBloggerPremiumProgress(userId: string): BloggerPremiumProgress {
  expireOldGrants(userId);

  const pubs = db
    .select()
    .from(schema.publications)
    .where(and(eq(schema.publications.userId, userId), eq(schema.publications.kind, "post")))
    .all();

  const platformViews = pubs.reduce((s, p) => s + (p.countedViews || 0), 0);

  const pubIds = pubs.map((p) => p.id);
  let platformComments = 0;
  if (pubIds.length) {
    // Count premium-eligible comments on author's publications
    const allComments = db.select().from(schema.comments).all();
    platformComments = allComments.filter(
      (c) =>
        c.targetType === "publication" &&
        pubIds.includes(c.targetId) &&
        (c.countsForPremium || 0) === 1
    ).length;
  }

  const ytPosts = db
    .select()
    .from(schema.socialPosts)
    .where(
      and(
        eq(schema.socialPosts.contentType, "publication"),
        eq(schema.socialPosts.platform, "youtube"),
        eq(schema.socialPosts.status, "published")
      )
    )
    .all()
    .filter((sp) => pubs.some((p) => p.id === sp.contentId));

  const youtubeReelsAt1M = ytPosts.filter((p) => (p.viewsCount || 0) >= YT_VIEWS_PER_REEL).length;

  const qualifies =
    youtubeReelsAt1M >= YT_REELS_NEEDED &&
    platformViews >= PLATFORM_VIEWS_NEEDED &&
    platformComments >= PLATFORM_COMMENTS_NEEDED;

  const grant = db
    .select()
    .from(schema.premiumGrants)
    .where(
      and(
        eq(schema.premiumGrants.userId, userId),
        eq(schema.premiumGrants.ruleSet, BLOGGER_V1),
        eq(schema.premiumGrants.status, "active")
      )
    )
    .get();

  return {
    ruleSet: BLOGGER_V1,
    youtubeReelsAt1M,
    youtubeReelsNeeded: YT_REELS_NEEDED,
    platformViews,
    platformViewsNeeded: PLATFORM_VIEWS_NEEDED,
    platformComments,
    platformCommentsNeeded: PLATFORM_COMMENTS_NEEDED,
    qualifies,
    activeGrant: grant
      ? {
          id: grant.id,
          startsAt: new Date(grant.startsAt as Date).toISOString(),
          endsAt: new Date(grant.endsAt as Date).toISOString(),
        }
      : null,
  };
}

/** If blogger qualifies and has no active grant, create 365d grant. */
export function evaluateBloggerV1(userId: string): BloggerPremiumProgress {
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  const progress = getBloggerPremiumProgress(userId);
  if (!user || user.platformRole !== "blogger") return progress;
  if (!progress.qualifies || progress.activeGrant) return progress;

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + GRANT_DAYS * 24 * 60 * 60 * 1000);
  db.insert(schema.premiumGrants)
    .values({
      id: uuid(),
      userId,
      ruleSet: BLOGGER_V1,
      status: "active",
      startsAt,
      endsAt,
      snapshotJson: JSON.stringify(progress),
    })
    .run();

  return getBloggerPremiumProgress(userId);
}

export function evaluateAllBloggers() {
  const bloggers = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.platformRole, "blogger"))
    .all();
  let granted = 0;
  for (const b of bloggers) {
    const before = getBloggerPremiumProgress(b.id).activeGrant;
    const after = evaluateBloggerV1(b.id);
    if (!before && after.activeGrant) granted += 1;
  }
  return { checked: bloggers.length, granted };
}
