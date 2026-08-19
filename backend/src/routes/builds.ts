import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { franchiseSlug, notify, unlinkUpload } from "../lib/notify";
import { pushStats } from "../lib/pushRealtime";

const router = Router();

function enrichCredits(targetId: string) {
  return db
    .select()
    .from(schema.credits)
    .where(and(eq(schema.credits.targetType, "build"), eq(schema.credits.targetId, targetId)))
    .all()
    .map((c) => {
      const u = db.select().from(schema.users).where(eq(schema.users.id, c.creditedUserId)).get();
      return { ...c, username: u?.username || null };
    });
}

function syncCredits(buildId: string, ownerId: string, credits?: { userId?: string; username?: string; role: string }[]) {
  if (!credits) return;
  db.delete(schema.credits)
    .where(and(eq(schema.credits.targetType, "build"), eq(schema.credits.targetId, buildId)))
    .run();
  for (const c of credits) {
    let userId = c.userId;
    if (!userId && c.username) {
      userId = db.select().from(schema.users).where(eq(schema.users.username, c.username)).get()?.id;
    }
    if (!userId) continue;
    db.insert(schema.credits)
      .values({
        id: uuid(),
        targetType: "build",
        targetId: buildId,
        creditedUserId: userId,
        role: c.role,
        confirmed: userId === ownerId,
      })
      .run();
    if (userId !== ownerId) {
      notify(userId, "credit_request", { targetType: "build", targetId: buildId, role: c.role, requesterId: ownerId });
    }
  }
}

function syncPhotos(buildId: string, photos?: { imageUrl: string; id?: string }[]) {
  if (!photos) return;
  const existing = db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, buildId)).all();
  const keep = new Set(photos.map((p) => p.imageUrl));
  for (const p of existing) {
    if (!keep.has(p.imageUrl)) {
      unlinkUpload(p.imageUrl);
      db.delete(schema.buildPhotos).where(eq(schema.buildPhotos.id, p.id)).run();
    }
  }
  for (const p of photos) {
    const found = existing.find((e) => e.imageUrl === p.imageUrl);
    if (!found) {
      db.insert(schema.buildPhotos)
        .values({ id: uuid(), buildId, imageUrl: p.imageUrl, consentStatus: "approved" })
        .run();
    }
  }
}

router.get("/", (req, res) => {
  const { franchise, userId } = req.query;
  let builds = db.select().from(schema.builds).all().filter((b) => !b.hidden);
  if (franchise) builds = builds.filter((b) => b.franchise === franchise);
  if (userId) builds = builds.filter((b) => b.userId === userId);
  res.json({ builds });
});

router.get("/:id", optionalAuth, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  if (build.hidden && req.userId !== build.userId) return res.status(404).json({ error: "Build not found" });
  const photos = db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, build.id)).all();
  const author = db.select().from(schema.users).where(eq(schema.users.id, build.userId)).get();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, build.userId)).get();
  const liked = req.userId
    ? Boolean(
        db
          .select()
          .from(schema.buildLikes)
          .where(and(eq(schema.buildLikes.userId, req.userId), eq(schema.buildLikes.buildId, build.id)))
          .get()
      )
    : false;
  res.json({
    build,
    photos,
    credits: enrichCredits(build.id),
    author: author
      ? { id: author.id, username: author.username, displayName: profile?.displayName, avatarUrl: profile?.avatarUrl }
      : null,
    isOwner: req.userId === build.userId,
    liked,
  });
});

router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: "title required" });
  const id = uuid();
  db.insert(schema.builds)
    .values({
      id,
      userId: req.userId!,
      title: body.title,
      franchise: body.franchise || null,
      character: body.character || null,
      coverImageUrl: body.coverImageUrl || null,
      description: body.description || null,
      year: body.year || null,
      price: body.price || 0,
      currency: body.currency || "UZS",
      category: body.category || franchiseSlug(body.franchise),
      workType: body.workType || null,
      commissionStatus: body.commissionStatus || "closed",
      hidden: Boolean(body.hidden),
    })
    .run();
  syncPhotos(id, body.photos);
  syncCredits(id, req.userId!, body.credits);
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, id)).get();
  res.status(201).json({ build, photos: db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, id)).all(), credits: enrichCredits(id) });
});

router.put("/:id", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  if (build.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const body = req.body || {};
  db.update(schema.builds)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.franchise !== undefined && { franchise: body.franchise, category: franchiseSlug(body.franchise) }),
      ...(body.character !== undefined && { character: body.character }),
      ...(body.coverImageUrl !== undefined && { coverImageUrl: body.coverImageUrl }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.year !== undefined && { year: body.year }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.workType !== undefined && { workType: body.workType }),
      ...(body.commissionStatus !== undefined && { commissionStatus: body.commissionStatus }),
      ...(body.hidden !== undefined && { hidden: Boolean(body.hidden) }),
    })
    .where(eq(schema.builds.id, build.id))
    .run();
  syncPhotos(build.id, body.photos);
  syncCredits(build.id, req.userId!, body.credits);
  const updated = db.select().from(schema.builds).where(eq(schema.builds.id, build.id)).get();
  res.json({
    build: updated,
    photos: db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, build.id)).all(),
    credits: enrichCredits(build.id),
  });
});

router.delete("/:id", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  if (build.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const photos = db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.buildId, build.id)).all();
  for (const p of photos) unlinkUpload(p.imageUrl);
  unlinkUpload(build.coverImageUrl);
  db.delete(schema.comments)
    .where(and(eq(schema.comments.targetType, "build"), eq(schema.comments.targetId, build.id)))
    .run();
  db.delete(schema.builds).where(eq(schema.builds.id, build.id)).run();
  res.json({ ok: true });
});

router.post("/:id/photos", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  if (build.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const { imageUrl, makerId, photographerId } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
  const needsConsent = Boolean(makerId || photographerId);
  const id = uuid();
  db.insert(schema.buildPhotos)
    .values({
      id,
      buildId: build.id,
      imageUrl,
      makerId: makerId || null,
      photographerId: photographerId || null,
      consentStatus: needsConsent ? "pending" : "approved",
    })
    .run();
  if (makerId) notify(makerId, "photo_consent", { buildId: build.id, photoId: id });
  if (photographerId && photographerId !== makerId) notify(photographerId, "photo_consent", { buildId: build.id, photoId: id });
  res.status(201).json({ photo: { id, buildId: build.id, imageUrl, consentStatus: needsConsent ? "pending" : "approved" } });
});

router.post("/:id/photos/:photoId/consent", authMiddleware, (req: AuthRequest, res) => {
  const photo = db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.id, req.params.photoId as string)).get();
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  if (photo.makerId !== req.userId && photo.photographerId !== req.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const decision = req.body.decision === "reject" ? "rejected" : "approved";
  db.update(schema.buildPhotos).set({ consentStatus: decision }).where(eq(schema.buildPhotos.id, photo.id)).run();
  res.json({ ok: true, consentStatus: decision });
});

router.delete("/:id/photos/:photoId", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build || build.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const photo = db.select().from(schema.buildPhotos).where(eq(schema.buildPhotos.id, req.params.photoId as string)).get();
  if (photo) {
    unlinkUpload(photo.imageUrl);
    db.delete(schema.buildPhotos).where(eq(schema.buildPhotos.id, photo.id)).run();
  }
  res.json({ ok: true });
});

router.post("/:id/like", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  const existing = db
    .select()
    .from(schema.buildLikes)
    .where(and(eq(schema.buildLikes.userId, req.userId!), eq(schema.buildLikes.buildId, build.id)))
    .get();
  if (!existing) {
    db.insert(schema.buildLikes).values({ userId: req.userId!, buildId: build.id }).run();
    db.update(schema.builds).set({ likesCount: (build.likesCount || 0) + 1 }).where(eq(schema.builds.id, build.id)).run();
    notify(build.userId, "like", { targetType: "build", targetId: build.id });
    pushStats(build.userId);
  }
  const updated = db.select().from(schema.builds).where(eq(schema.builds.id, build.id)).get();
  res.json({ liked: true, likesCount: updated?.likesCount || 0 });
});

router.delete("/:id/like", authMiddleware, (req: AuthRequest, res) => {
  const build = db.select().from(schema.builds).where(eq(schema.builds.id, req.params.id as string)).get();
  if (!build) return res.status(404).json({ error: "Build not found" });
  const existing = db
    .select()
    .from(schema.buildLikes)
    .where(and(eq(schema.buildLikes.userId, req.userId!), eq(schema.buildLikes.buildId, build.id)))
    .get();
  if (existing) {
    db.delete(schema.buildLikes)
      .where(and(eq(schema.buildLikes.userId, req.userId!), eq(schema.buildLikes.buildId, build.id)))
      .run();
    db.update(schema.builds)
      .set({ likesCount: Math.max(0, (build.likesCount || 0) - 1) })
      .where(eq(schema.builds.id, build.id))
      .run();
    pushStats(build.userId);
  }
  const updated = db.select().from(schema.builds).where(eq(schema.builds.id, build.id)).get();
  res.json({ liked: false, likesCount: updated?.likesCount || 0 });
});

export default router;
