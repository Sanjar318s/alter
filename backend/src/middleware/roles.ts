import { NextFunction, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { AuthRequest } from "./auth";
import { ADMIN_USERNAME, isOwnerUsername } from "../lib/owner";

export type AdminPermissionKey =
  | "canViewUsers"
  | "canViewReports"
  | "canViewOrders"
  | "canViewChats"
  | "canViewFinance"
  | "canManageStaff"
  | "canUseBlacklist";

function ensureOwnerProfile(userId: string) {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (!profile) return;
  if (profile.staffRole !== "owner" || !profile.staffBadgeHidden) {
    db.update(schema.profiles)
      .set({ staffRole: "owner", staffBadgeHidden: false })
      .where(eq(schema.profiles.userId, userId))
      .run();
  }
}

export function isOwnerById(userId: string) {
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return false;
  const ok = isOwnerUsername(user.username);
  if (ok) ensureOwnerProfile(userId);
  return ok;
}

export function ownerOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!isOwnerById(req.userId)) return res.status(403).json({ error: `Owner only (${ADMIN_USERNAME})` });
  next();
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  if (isOwnerById(req.userId)) return next();
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId)).get();
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const isAdmin = (user.roleFlags || "")
    .split(",")
    .map((x) => x.trim())
    .includes("admin");
  if (!isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}

export function hasAdminPermission(userId: string, key: AdminPermissionKey) {
  if (isOwnerById(userId)) return true;
  const row = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, userId)).get();
  if (!row) return false;
  return Boolean(row[key]);
}

export function requireAdminPermission(key: AdminPermissionKey) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!hasAdminPermission(req.userId, key)) {
      return res.status(403).json({ error: `Missing permission: ${key}` });
    }
    next();
  };
}

export function upsertAdminPermissions(userId: string, patch: Partial<Record<AdminPermissionKey, boolean>>, actorId?: string) {
  const existing = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, userId)).get();
  const next = {
    canViewUsers: patch.canViewUsers ?? existing?.canViewUsers ?? true,
    canViewReports: patch.canViewReports ?? existing?.canViewReports ?? true,
    canViewOrders: patch.canViewOrders ?? existing?.canViewOrders ?? true,
    canViewChats: patch.canViewChats ?? existing?.canViewChats ?? true,
    canViewFinance: patch.canViewFinance ?? existing?.canViewFinance ?? false,
    canManageStaff: patch.canManageStaff ?? existing?.canManageStaff ?? false,
    canUseBlacklist: patch.canUseBlacklist ?? existing?.canUseBlacklist ?? false,
    updatedBy: actorId || null,
    updatedAt: new Date(),
  };
  if (existing) {
    db.update(schema.adminPermissions).set(next).where(eq(schema.adminPermissions.userId, userId)).run();
  } else {
    db.insert(schema.adminPermissions).values({ userId, ...next }).run();
  }
  return db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, userId)).get();
}

export function setStaffRole(userId: string, role: "owner" | "admin" | "none") {
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (profile) {
    db.update(schema.profiles).set({ staffRole: role }).where(eq(schema.profiles.userId, userId)).run();
  } else {
    db.insert(schema.profiles).values({ userId, staffRole: role }).run();
  }
}
