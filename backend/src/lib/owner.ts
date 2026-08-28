import { eq } from "drizzle-orm";
import { db, schema } from "../db";

/** Configured owner nick — used only for bootstrap when no staffRole owner exists yet. */
export const OWNER_USERNAME = (process.env.OWNER_USERNAME || "nyx.cosplay").trim().toLowerCase();

/** @deprecated Use OWNER_USERNAME or getOwnerUsername(). Kept for existing imports. */
export const ADMIN_USERNAME = OWNER_USERNAME;

export function isOwnerStaffRole(staffRole?: string | null) {
  return staffRole === "owner";
}

function findUserByUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return db
    .select()
    .from(schema.users)
    .all()
    .find((u) => (u.username || "").trim().toLowerCase() === normalized);
}

export function ensureOwnerProfile(userId: string) {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (!profile) return;
  if (profile.staffRole !== "owner" || profile.staffBadgeHidden) {
    db.update(schema.profiles)
      .set({ staffRole: "owner", staffBadgeHidden: false })
      .where(eq(schema.profiles.userId, userId))
      .run();
  }
}

/** Source of truth: profiles.staffRole === "owner". */
export function getOwnerUser() {
  const owners = db
    .select({ user: schema.users, profile: schema.profiles })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(eq(schema.profiles.staffRole, "owner"))
    .all();

  if (owners.length === 1) return owners[0].user;
  if (owners.length > 1) {
    const match = owners.find((row) => (row.user.username || "").trim().toLowerCase() === OWNER_USERNAME);
    return (match || owners[0]).user;
  }

  const configured = findUserByUsername(OWNER_USERNAME);
  if (configured) {
    ensureOwnerProfile(configured.id);
    return configured;
  }
  return null;
}

export function getOwnerUserId() {
  return getOwnerUser()?.id || null;
}

export function getOwnerUsername() {
  return getOwnerUser()?.username || OWNER_USERNAME;
}

export function isOwnerById(userId: string) {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (isOwnerStaffRole(profile?.staffRole)) return true;

  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return false;

  if ((user.username || "").trim().toLowerCase() === OWNER_USERNAME) {
    ensureOwnerProfile(userId);
    return true;
  }
  return false;
}

export function isOwnerUsername(username?: string | null) {
  if (!username) return false;
  const normalized = username.trim().toLowerCase();
  const user = findUserByUsername(normalized);
  if (user) {
    const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
    if (isOwnerStaffRole(profile?.staffRole)) return true;
  }
  const owner = getOwnerUser();
  if (owner) return owner.username.trim().toLowerCase() === normalized;
  return normalized === OWNER_USERNAME;
}

export function normalizeUsername(username: string) {
  const trimmed = username.trim();
  return isOwnerUsername(trimmed) ? getOwnerUsername() : trimmed;
}

export function isAdminUser(user: { username?: string | null; roleFlags?: string | null } | null | undefined) {
  if (!user) return false;
  if (isOwnerUsername(user.username)) return true;
  return (user.roleFlags || "")
    .split(",")
    .map((s) => s.trim())
    .includes("admin");
}

/** Client cannot self-grant admin. Owner account always gets it. */
export function flagsForUsername(roleFlags: string | undefined, username: string) {
  const parts = (roleFlags || "cosplayer")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "admin");
  if (isOwnerUsername(username)) parts.push("admin");
  return [...new Set(parts)].join(",") || "cosplayer";
}

/** Ensure configured owner nick has staffRole owner on boot. */
export function syncPlatformOwner() {
  const owner = getOwnerUser();
  if (owner) {
    ensureOwnerProfile(owner.id);
    return owner.username;
  }
  return null;
}
