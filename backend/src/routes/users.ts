import { Router } from "express";
import { db, schema } from "../db";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { notify } from "../lib/notify";
import { pushStats } from "../lib/pushRealtime";
import { getUserStats } from "../lib/userStats";
import { isOwnerUsername } from "../lib/owner";

const router = Router();

function publicUser(id: string) {
  const u = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!u) return null;
  const p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, id)).get();
  return { id: u.id, username: u.username, displayName: p?.displayName, avatarUrl: p?.avatarUrl };
}

router.get("/search", authMiddleware, (req: AuthRequest, res) => {
  const q = String(req.query.q || "").toLowerCase().trim().replace(/^@+/, "");
  const users = db
    .select()
    .from(schema.users)
    .all()
    .filter((u) => {
      if (u.id === req.userId) return false;
      const p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get();
      if (!q) return true;
      return u.username.toLowerCase().includes(q) || (p?.displayName || "").toLowerCase().includes(q);
    })
    .slice(0, 12)
    .map((u) => publicUser(u.id))
    .filter(Boolean);
  res.json({ users });
});

router.get("/:username/followers", (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const rows = db.select().from(schema.follows).where(eq(schema.follows.followingId, user.id)).all();
  res.json({ users: rows.map((r) => publicUser(r.followerId)).filter(Boolean) });
});

router.get("/:username/following", (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const rows = db.select().from(schema.follows).where(eq(schema.follows.followerId, user.id)).all();
  res.json({ users: rows.map((r) => publicUser(r.followingId)).filter(Boolean) });
});

router.get("/:username/stats", (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const builds = db.select().from(schema.builds).where(eq(schema.builds.userId, user.id)).all();
  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, user.id)).all();
  const followers = db.select().from(schema.follows).where(eq(schema.follows.followingId, user.id)).all();
  const following = db.select().from(schema.follows).where(eq(schema.follows.followerId, user.id)).all();
  const likes = builds.reduce((s, b) => s + (b.likesCount || 0), 0);
  res.json({
    stats: {
      builds: builds.length,
      orders: orders.length,
      followers: followers.length,
      following: following.length,
      likes,
    },
  });
});

router.get("/:username/activity", (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const days = 14;
  const buckets: number[] = Array(days).fill(0);
  const now = Date.now();
  const pubs = db.select().from(schema.publications).where(eq(schema.publications.userId, user.id)).all();
  const msgs = db.select().from(schema.messages).where(eq(schema.messages.senderId, user.id)).all();
  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, user.id)).all();
  for (const item of [...pubs, ...msgs, ...orders]) {
    const t = new Date((item as { createdAt?: Date }).createdAt || 0).getTime();
    const diff = Math.floor((now - t) / 86400000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
  }
  res.json({ activity: buckets });
});

router.put("/:username/events", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const events = Array.isArray(req.body.events) ? req.body.events : [];
  db.update(schema.profiles)
    .set({ eventsJson: JSON.stringify(events) })
    .where(eq(schema.profiles.userId, user.id))
    .run();
  res.json({ events });
});

router.get("/:username/orders", optionalAuth, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const allowed = new Set(["done", "shipped", "cancelled"]);
  const rows = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.makerId, user.id))
    .all()
    .filter((o) => allowed.has(o.status || ""));
  const done = rows.filter((o) => o.status === "done" || o.status === "shipped");
  const budgets = done.map((o) => o.budget).filter((n): n is number => typeof n === "number" && n > 0);
  const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : null;
  const deadlines = done
    .map((o) => (o.deadline ? new Date(o.deadline as Date).getTime() : null))
    .filter((n): n is number => n != null);
  res.json({
    orders: rows.map((o) => ({
      id: o.id,
      title: o.title,
      character: o.character,
      status: o.status,
      createdAt: o.deadline || null,
    })),
    avgBudget,
    deadlineCount: deadlines.length,
  });
});

router.get("/:username", optionalAuth, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });

  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  const effectiveProfile = profile
    ? { ...profile, staffRole: profile.staffRole || (isOwnerUsername(user.username) ? "owner" : "none") }
    : { userId: user.id, staffRole: isOwnerUsername(user.username) ? "owner" : "none", staffBadgeHidden: false } as any;
  const isOwner = req.userId === user.id;
  let privacy: Record<string, string> = {};
  try {
    privacy = profile?.privacySettings ? JSON.parse(profile.privacySettings) : {};
  } catch {
    privacy = {};
  }
  const vis = privacy.profile || (profile?.isPrivate ? "private" : "public");
  if (vis === "private" && !isOwner) {
    return res.json({
      user: { id: user.id, username: user.username, roleFlags: user.roleFlags },
      profile: { displayName: profile?.displayName, avatarUrl: profile?.avatarUrl, isPrivate: true },
      builds: [],
      stories: [],
      commissions: [],
      events: [],
      stats: { builds: 0, followers: 0, following: 0, likes: 0 },
      isFollowing: false,
      isOwner: false,
      isPrivate: true,
    });
  }

  const builds = db.select().from(schema.builds).where(eq(schema.builds.userId, user.id)).all();
  const stories = db.select().from(schema.stories).where(eq(schema.stories.userId, user.id)).all();
  const commissions = db.select().from(schema.commissions).where(eq(schema.commissions.makerId, user.id)).all();
  const followers = db.select().from(schema.follows).where(eq(schema.follows.followingId, user.id)).all();
  const following = db.select().from(schema.follows).where(eq(schema.follows.followerId, user.id)).all();
  const isFollowing = req.userId
    ? Boolean(
        db
          .select()
          .from(schema.follows)
          .where(and(eq(schema.follows.followerId, req.userId), eq(schema.follows.followingId, user.id)))
          .get()
      )
    : false;
  const likes = builds.reduce((s, b) => s + (b.likesCount || 0), 0);
  let events: unknown[] = [];
  try {
    events = profile?.eventsJson ? JSON.parse(profile.eventsJson) : [];
  } catch {
    events = [];
  }

  res.json({
    user: { id: user.id, username: user.username, roleFlags: user.roleFlags },
    profile: effectiveProfile,
    builds: builds.filter((b) => !b.hidden || isOwner),
    stories,
    commissions,
    events,
    stats: { builds: builds.length, followers: followers.length, following: following.length, likes, orders: db.select().from(schema.orders).where(eq(schema.orders.makerId, user.id)).all().length },
    isFollowing,
    isOwner,
    isPrivate: false,
    lastSeen: effectiveProfile?.lastSeen || null,
  });
});

router.get("/:username/events", (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  let events: unknown[] = [];
  try {
    events = profile?.eventsJson ? JSON.parse(profile.eventsJson) : [];
  } catch {
    events = [];
  }
  res.json({ events });
});

router.post("/:username/follow", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.id === req.userId) return res.status(400).json({ error: "Cannot follow yourself" });
  const existing = db
    .select()
    .from(schema.follows)
    .where(and(eq(schema.follows.followerId, req.userId!), eq(schema.follows.followingId, user.id)))
    .get();
  if (!existing) {
    db.insert(schema.follows).values({ followerId: req.userId!, followingId: user.id }).run();
    notify(user.id, "follow", { followerId: req.userId });
  }
  pushStats(user.id);
  pushStats(req.userId!);
  const targetStats = getUserStats(user.id);
  res.json({ ok: true, following: true, stats: targetStats?.stats });
});

router.delete("/:username/follow", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  db.delete(schema.follows)
    .where(and(eq(schema.follows.followerId, req.userId!), eq(schema.follows.followingId, user.id)))
    .run();
  pushStats(user.id);
  pushStats(req.userId!);
  const targetStats = getUserStats(user.id);
  res.json({ ok: true, following: false, stats: targetStats?.stats });
});

router.put("/:username/profile", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.username, req.params.username as string)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const body = req.body || {};
  db.update(schema.profiles)
    .set({
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.bio !== undefined && { bio: body.bio }),
      ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl }),
      ...(body.linksJson !== undefined && { linksJson: body.linksJson }),
      ...(body.privacySettings !== undefined && { privacySettings: body.privacySettings }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.commissionStatus !== undefined && { commissionStatus: body.commissionStatus }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.languagesJson !== undefined && { languagesJson: body.languagesJson }),
      ...(body.specializationsJson !== undefined && { specializationsJson: body.specializationsJson }),
      ...(body.availability !== undefined && { availability: body.availability }),
      ...(body.maxActiveOrders !== undefined && { maxActiveOrders: body.maxActiveOrders }),
      ...(body.dateOfBirth !== undefined && { dateOfBirth: body.dateOfBirth }),
      ...(body.showAge !== undefined && { showAge: body.showAge }),
      ...(body.eventsJson !== undefined && { eventsJson: body.eventsJson }),
    })
    .where(eq(schema.profiles.userId, user.id))
    .run();
  const updated = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  res.json({ profile: updated });
});

export default router;
