import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { eq, ne, and } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { flagsForUsername } from "../lib/owner";

const router = Router();

router.get("/username-available", (req, res) => {
  const username = String(req.query.username || "").trim();
  if (!username) return res.status(400).json({ error: "username required" });
  const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  res.json({ available: !existing });
});

router.patch("/password", authMiddleware, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid password" });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id)).run();
  res.json({ ok: true });
});

router.get("/export", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, req.userId!)).get();
  const builds = db.select().from(schema.builds).where(eq(schema.builds.userId, req.userId!)).all();
  res.json({
    exportedAt: new Date().toISOString(),
    user: user ? { id: user.id, email: user.email, username: user.username, roleFlags: user.roleFlags } : null,
    profile,
    builds,
  });
});

router.delete("/", authMiddleware, (req: AuthRequest, res) => {
  const { confirm } = req.body;
  if (confirm !== "DELETE") return res.status(400).json({ error: "Type DELETE to confirm" });
  db.delete(schema.users).where(eq(schema.users.id, req.userId!)).run();
  res.json({ ok: true });
});

router.patch("/profile", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });

  const {
    username,
    displayName,
    bio,
    city,
    country,
    phone,
    languagesJson,
    specializationsJson,
    availability,
    maxActiveOrders,
    dateOfBirth,
    showAge,
    commissionStatus,
    avatarUrl,
    coverUrl,
    linksJson,
    privacySettings,
    roleFlags,
    platformRole,
    commissionComplexity,
    commissionTypes,
    commissionDuration,
    experienceYears,
    materialsJson,
    uiLocale,
    uiCurrency,
  } = req.body;

  const ALLOWED_PLATFORM_ROLES = new Set(["client", "blogger", "seller"]);
  if (platformRole !== undefined) {
    const next = String(platformRole || "").trim();
    if (!ALLOWED_PLATFORM_ROLES.has(next)) {
      return res.status(400).json({ error: "Недопустимая роль платформы" });
    }
    if (user.platformRole) {
      return res.status(403).json({
        error: "Роль уже выбрана. Смена возможна только через заявку модератору.",
      });
    }
    db.update(schema.users).set({ platformRole: next }).where(eq(schema.users.id, user.id)).run();
  }

  const nextUsername = username && username !== user.username ? String(username).trim() : user.username;
  if (username && username !== user.username) {
    const taken = db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.username, nextUsername), ne(schema.users.id, user.id)))
      .get();
    if (taken) return res.status(409).json({ error: "Username taken" });
    db.update(schema.users).set({ username: nextUsername }).where(eq(schema.users.id, user.id)).run();
  }
  const nextFlags = flagsForUsername(roleFlags !== undefined ? roleFlags : user.roleFlags || undefined, nextUsername);
  if (nextFlags !== (user.roleFlags || "")) {
    db.update(schema.users).set({ roleFlags: nextFlags }).where(eq(schema.users.id, user.id)).run();
  }

  const profilePatch: Record<string, unknown> = {
    ...(displayName !== undefined && { displayName }),
    ...(bio !== undefined && { bio }),
    ...(city !== undefined && { city }),
    ...(country !== undefined && { country }),
    ...(phone !== undefined && { phone }),
    ...(languagesJson !== undefined && { languagesJson }),
    ...(specializationsJson !== undefined && { specializationsJson }),
    ...(availability !== undefined && { availability }),
    ...(maxActiveOrders !== undefined && { maxActiveOrders }),
    ...(dateOfBirth !== undefined && { dateOfBirth }),
    ...(showAge !== undefined && { showAge }),
    ...(commissionStatus !== undefined && { commissionStatus }),
    ...(avatarUrl !== undefined && { avatarUrl }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(linksJson !== undefined && { linksJson }),
    ...(privacySettings !== undefined && { privacySettings }),
    ...(commissionComplexity !== undefined && { commissionComplexity }),
    ...(commissionTypes !== undefined && { commissionTypes }),
    ...(commissionDuration !== undefined && { commissionDuration }),
    ...(experienceYears !== undefined && { experienceYears: experienceYears === "" || experienceYears == null ? null : Number(experienceYears) }),
    ...(materialsJson !== undefined && { materialsJson }),
    ...(uiLocale !== undefined && { uiLocale }),
    ...(uiCurrency !== undefined && { uiCurrency }),
  };
  if (Object.keys(profilePatch).length > 0) {
    db.update(schema.profiles)
      .set(profilePatch)
      .where(eq(schema.profiles.userId, user.id))
      .run();
  }

  const updatedUser = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  res.json({
    user: {
      id: updatedUser!.id,
      email: updatedUser!.email,
      username: updatedUser!.username,
      roleFlags: updatedUser!.roleFlags,
      platformRole: updatedUser!.platformRole || null,
    },
    profile,
  });
});

function notifDefaults() {
  return { orders: true, messages: true, likes: true, follows: true, email: false };
}

router.get("/notification-settings", authMiddleware, (req: AuthRequest, res) => {
  const row = db
    .select()
    .from(schema.accountNotificationSettings)
    .where(eq(schema.accountNotificationSettings.userId, req.userId!))
    .get();
  res.json({ settings: row || { userId: req.userId, ...notifDefaults() } });
});

router.patch("/notification-settings", authMiddleware, (req: AuthRequest, res) => {
  const body = req.body || {};
  const existing = db
    .select()
    .from(schema.accountNotificationSettings)
    .where(eq(schema.accountNotificationSettings.userId, req.userId!))
    .get();
  const next = {
    orders: body.orders ?? existing?.orders ?? true,
    messages: body.messages ?? existing?.messages ?? true,
    likes: body.likes ?? existing?.likes ?? true,
    follows: body.follows ?? existing?.follows ?? true,
    email: body.email ?? existing?.email ?? false,
  };
  if (existing) {
    db.update(schema.accountNotificationSettings).set(next).where(eq(schema.accountNotificationSettings.userId, req.userId!)).run();
  } else {
    db.insert(schema.accountNotificationSettings).values({ userId: req.userId!, ...next }).run();
  }
  res.json({ settings: { userId: req.userId, ...next } });
});

router.get("/privacy", authMiddleware, (req: AuthRequest, res) => {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, req.userId!)).get();
  let settings = { profile: "public", orders: "private", stats: "public" };
  try {
    settings = { ...settings, ...(profile?.privacySettings ? JSON.parse(profile.privacySettings) : {}) };
  } catch {
    /* keep defaults */
  }
  res.json({ settings, isPrivate: Boolean(profile?.isPrivate) });
});

router.patch("/privacy", authMiddleware, (req: AuthRequest, res) => {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, req.userId!)).get();
  let current: Record<string, string> = {};
  try {
    current = profile?.privacySettings ? JSON.parse(profile.privacySettings) : {};
  } catch {
    current = {};
  }
  const settings = { ...current, ...req.body };
  db.update(schema.profiles)
    .set({
      privacySettings: JSON.stringify(settings),
      isPrivate: settings.profile === "private",
    })
    .where(eq(schema.profiles.userId, req.userId!))
    .run();
  res.json({ settings });
});

router.get("/blocked", authMiddleware, (req: AuthRequest, res) => {
  const rows = db.select().from(schema.blocks).where(eq(schema.blocks.blockerId, req.userId!)).all();
  const users = rows.map((r) => {
    const u = db.select().from(schema.users).where(eq(schema.users.id, r.blockedId)).get();
    const p = u ? db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get() : null;
    return u ? { id: u.id, username: u.username, displayName: p?.displayName, avatarUrl: p?.avatarUrl } : null;
  }).filter(Boolean);
  res.json({ users });
});

router.get("/completeness", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, req.userId!)).get();
  const builds = db.select().from(schema.builds).where(eq(schema.builds.userId, req.userId!)).all();
  const checks = [
    Boolean(profile?.avatarUrl),
    Boolean(profile?.bio),
    Boolean(profile?.city),
    Boolean(profile?.displayName),
    builds.length > 0,
    Boolean(profile?.isVerified),
    Boolean(user?.email && !user.email.includes("@phone.alter.local")),
  ];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  res.json({ percent, checks: { avatar: checks[0], bio: checks[1], city: checks[2], name: checks[3], portfolio: checks[4], verified: checks[5], email: checks[6] } });
});

const PLATFORM_ROLES = new Set(["client", "blogger", "seller"]);

router.get("/role-change-requests", authMiddleware, (req: AuthRequest, res) => {
  const rows = db
    .select()
    .from(schema.moderationRequests)
    .where(eq(schema.moderationRequests.userId, req.userId!))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ requests: rows });
});

router.post("/role-change-requests", authMiddleware, (req: AuthRequest, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.platformRole) {
    return res.status(400).json({ error: "Сначала выберите роль в онбординге" });
  }

  const requestedRole = String(req.body.requestedRole || "").trim();
  const reason = String(req.body.reason || "").trim();
  const activityExplanation = String(req.body.activityExplanation || "").trim();
  if (!PLATFORM_ROLES.has(requestedRole)) {
    return res.status(400).json({ error: "Недопустимая роль" });
  }
  if (requestedRole === user.platformRole) {
    return res.status(400).json({ error: "Вы уже в этой роли" });
  }
  if (reason.length < 10) {
    return res.status(400).json({ error: "Укажите причину подробнее (минимум 10 символов)" });
  }
  if (activityExplanation.length < 20) {
    return res.status(400).json({ error: "Опишите деятельность подробнее (минимум 20 символов)" });
  }

  const pending = db
    .select()
    .from(schema.moderationRequests)
    .where(
      and(
        eq(schema.moderationRequests.userId, user.id),
        eq(schema.moderationRequests.type, "role_change"),
        eq(schema.moderationRequests.status, "pending")
      )
    )
    .get();
  if (pending) {
    return res.status(409).json({ error: "У вас уже есть заявка на рассмотрении" });
  }

  const id = uuid();
  db.insert(schema.moderationRequests)
    .values({
      id,
      userId: user.id,
      type: "role_change",
      currentRole: user.platformRole,
      requestedRole,
      reason,
      activityExplanation,
      status: "pending",
    })
    .run();

  const row = db.select().from(schema.moderationRequests).where(eq(schema.moderationRequests.id, id)).get();
  res.status(201).json({ request: row });
});

export default router;
