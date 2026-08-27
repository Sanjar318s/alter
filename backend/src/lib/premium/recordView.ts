import { and, desc, eq, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../../db";

const MAX_COUNTED_PER_WINDOW = 3;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Record a platform view for Premium antifraud.
 * Returns whether this call incremented the publication's counted_views.
 */
export function recordPublicationView(
  publicationId: string,
  viewerUserId: string
): { counted: boolean; countedViews: number } {
  const pub = db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.id, publicationId))
    .get();
  if (!pub || pub.kind !== "post") {
    return { counted: false, countedViews: pub?.countedViews || 0 };
  }
  // Own views never count
  if (pub.userId === viewerUserId) {
    return { counted: false, countedViews: pub.countedViews || 0 };
  }

  const now = Date.now();
  const rows = db
    .select()
    .from(schema.publicationViews)
    .where(
      and(
        eq(schema.publicationViews.publicationId, publicationId),
        eq(schema.publicationViews.viewerUserId, viewerUserId)
      )
    )
    .orderBy(desc(schema.publicationViews.countedAt))
    .all();

  let windowStart = rows[0]?.windowStartedAt
    ? new Date(rows[0].windowStartedAt as Date).getTime()
    : now;

  // Drop expired window rows conceptually: if oldest in current window is >30d from window start, reset
  const inWindow = rows.filter((r) => {
    const ws = new Date(r.windowStartedAt as Date).getTime();
    const ca = new Date(r.countedAt as Date).getTime();
    // Same window if windowStartedAt matches latest window and within 30d of that start
    return ws === windowStart && ca - ws < WINDOW_MS && now - ws < WINDOW_MS;
  });

  if (!inWindow.length || now - windowStart >= WINDOW_MS) {
    windowStart = now;
  }

  const countedInWindow = rows.filter((r) => {
    const ws = new Date(r.windowStartedAt as Date).getTime();
    return ws === windowStart;
  }).length;

  if (countedInWindow >= MAX_COUNTED_PER_WINDOW) {
    return { counted: false, countedViews: pub.countedViews || 0 };
  }

  db.insert(schema.publicationViews)
    .values({
      id: uuid(),
      publicationId,
      viewerUserId,
      countedAt: new Date(now),
      windowStartedAt: new Date(windowStart),
    })
    .run();

  const next = (pub.countedViews || 0) + 1;
  db.update(schema.publications)
    .set({ countedViews: next })
    .where(eq(schema.publications.id, publicationId))
    .run();

  return { counted: true, countedViews: next };
}
