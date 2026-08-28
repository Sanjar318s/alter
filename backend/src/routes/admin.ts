import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { getOwnerUsername, flagsForUsername, isOwnerById } from "../lib/owner";
import { ownerOnly, requireAdminPermission, setStaffRole, upsertAdminPermissions } from "../middleware/roles";
import { logAuditEvent } from "../lib/audit";
import { getActiveBan } from "../lib/blocking";
import { escalateOverdueReports } from "../lib/reportEscalation";
import { getModerationSettings, updateModerationSettings } from "../lib/moderationSettings";
import { v4 as uuid } from "uuid";

const router = Router();

function reportPriorityMeta(report: { targetType: string; reason: string; details?: string | null; createdAt: Date }) {
  const text = `${report.reason || ""} ${report.details || ""}`.toLowerCase();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(report.createdAt).getTime()) / 60000));
  let priority: "P1" | "P2" | "P3" = "P3";
  let slaMinutes = 24 * 60;
  if (
    report.targetType === "user" &&
    (text.includes("мошен") || text.includes("fraud") || text.includes("угроз") || text.includes("harass"))
  ) {
    priority = "P1";
    slaMinutes = 30;
  } else if (
    report.targetType === "message" ||
    text.includes("оскорб") ||
    text.includes("токс") ||
    text.includes("spam")
  ) {
    priority = "P2";
    slaMinutes = 120;
  }
  const overdue = ageMinutes > slaMinutes;
  return { priority, slaMinutes, ageMinutes, overdue };
}

router.use(authMiddleware, adminMiddleware);

router.get("/audit", requireAdminPermission("canViewReports"), (req, res) => {
  const type = String(req.query.type || "all");
  const severity = String(req.query.severity || "all");
  const actor = String(req.query.actor || "").trim().toLowerCase();
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  const rows = db
    .select()
    .from(schema.auditEvents)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((e) => (type === "all" ? true : e.type === type))
    .filter((e) => (severity === "all" ? true : (e.severity || "info") === severity))
    .map((e) => {
      const actorUser = e.actorId ? db.select().from(schema.users).where(eq(schema.users.id, e.actorId)).get() : null;
      const actorUsername = actorUser?.username || null;
      let targetUsername: string | null = null;
      if (e.targetType === "user" || e.targetType === "staff") {
        const targetUser = db.select().from(schema.users).where(eq(schema.users.id, e.targetId)).get();
        targetUsername = targetUser?.username || null;
      }
      let payload: unknown = null;
      if (e.payloadJson) {
        try {
          payload = JSON.parse(e.payloadJson);
        } catch {
          payload = null;
        }
      }
      return { ...e, actorUsername, targetUsername, payload };
    })
    .filter((e) => (actor ? (e.actorUsername || "").toLowerCase().includes(actor) : true))
    .filter((e) => {
      if (!q) return true;
      const payload = (e.payloadJson || "").toLowerCase();
      return (
        (e.type || "").toLowerCase().includes(q) ||
        (e.targetType || "").toLowerCase().includes(q) ||
        (e.targetId || "").toLowerCase().includes(q) ||
        (e.actorUsername || "").toLowerCase().includes(q) ||
        payload.includes(q)
      );
    })
    .slice(0, limit);

  res.json({ events: rows });
});

router.get("/audit/export.csv", requireAdminPermission("canViewReports"), (req, res) => {
  const type = String(req.query.type || "all");
  const severity = String(req.query.severity || "all");
  const actor = String(req.query.actor || "").trim().toLowerCase();
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);

  const rows = db
    .select()
    .from(schema.auditEvents)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((e) => (type === "all" ? true : e.type === type))
    .filter((e) => (severity === "all" ? true : (e.severity || "info") === severity))
    .map((e) => {
      const actorUser = e.actorId ? db.select().from(schema.users).where(eq(schema.users.id, e.actorId)).get() : null;
      const actorUsername = actorUser?.username || "";
      return { ...e, actorUsername };
    })
    .filter((e) => (actor ? (e.actorUsername || "").toLowerCase().includes(actor) : true))
    .filter((e) => {
      if (!q) return true;
      const payload = (e.payloadJson || "").toLowerCase();
      return (
        (e.type || "").toLowerCase().includes(q) ||
        (e.targetType || "").toLowerCase().includes(q) ||
        (e.targetId || "").toLowerCase().includes(q) ||
        (e.actorUsername || "").toLowerCase().includes(q) ||
        payload.includes(q)
      );
    })
    .slice(0, limit);

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "createdAt",
    "type",
    "severity",
    "actorId",
    "actorUsername",
    "targetType",
    "targetId",
    "payloadJson",
  ];
  const lines = [
    header.join(","),
    ...rows.map((e) =>
      [
        esc(e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt),
        esc(e.type),
        esc(e.severity || "info"),
        esc(e.actorId || ""),
        esc(e.actorUsername || ""),
        esc(e.targetType),
        esc(e.targetId),
        esc(e.payloadJson || ""),
      ].join(",")
    ),
  ];
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-events.csv"`);
  res.send(csv);
});

router.get("/moderation/settings", requireAdminPermission("canViewReports"), (_req, res) => {
  res.json({ settings: getModerationSettings() });
});

router.patch("/moderation/settings", requireAdminPermission("canViewReports"), (req: AuthRequest, res) => {
  const settings = updateModerationSettings(
    {
      autoEscalateEnabled:
        req.body.autoEscalateEnabled === undefined ? undefined : Boolean(req.body.autoEscalateEnabled),
      autoEscalateIntervalMs:
        req.body.autoEscalateIntervalMs === undefined ? undefined : Number(req.body.autoEscalateIntervalMs),
      escalationCooldownMs:
        req.body.escalationCooldownMs === undefined ? undefined : Number(req.body.escalationCooldownMs),
    },
    req.userId
  );
  logAuditEvent({
    type: "moderation_settings_updated",
    actorId: req.userId!,
    targetType: "staff",
    targetId: "global_moderation_settings",
    severity: "high",
    payload: settings,
  });
  res.json({ ok: true, settings });
});

router.get("/moderation/settings/history", requireAdminPermission("canViewReports"), (_req, res) => {
  const rows = db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.type, "moderation_settings_updated"))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30)
    .map((e) => {
      const actor = e.actorId ? db.select().from(schema.users).where(eq(schema.users.id, e.actorId)).get() : null;
      let payload: unknown = null;
      try {
        payload = e.payloadJson ? JSON.parse(e.payloadJson) : null;
      } catch {
        payload = e.payloadJson;
      }
      return {
        id: e.id,
        createdAt: e.createdAt,
        actor: actor ? { id: actor.id, username: actor.username } : null,
        payload,
      };
    });
  res.json({ history: rows });
});

router.get("/reports", requireAdminPermission("canViewReports"), (_req, res) => {
  const reports = db
    .select()
    .from(schema.reports)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => {
      const reporter = db.select().from(schema.users).where(eq(schema.users.id, r.reporterId)).get();
      const assignee = r.assignedTo
        ? db.select().from(schema.users).where(eq(schema.users.id, r.assignedTo)).get()
        : null;
      const meta = reportPriorityMeta(r);
      let targetUsername: string | null = null;
      if (r.targetType === "user") {
        const u = db.select().from(schema.users).where(eq(schema.users.id, r.targetId)).get();
        targetUsername = u?.username || null;
      } else if (r.targetType === "message") {
        const m = db.select().from(schema.messages).where(eq(schema.messages.id, r.targetId)).get();
        if (m) {
          const u = db.select().from(schema.users).where(eq(schema.users.id, m.senderId)).get();
          targetUsername = u?.username || null;
        }
      }
      return {
        ...r,
        ...meta,
        targetUsername,
        reporter: reporter ? { id: reporter.id, username: reporter.username } : null,
        assignee: assignee ? { id: assignee.id, username: assignee.username } : null,
      };
    });
  const pending = reports.filter((r) => r.status === "pending" || r.status === "in_review");
  const queue = {
    pending: pending.length,
    p1: pending.filter((r) => r.priority === "P1").length,
    p2: pending.filter((r) => r.priority === "P2").length,
    p3: pending.filter((r) => r.priority === "P3").length,
    overdue: pending.filter((r) => r.overdue).length,
  };
  const queueItems = pending.sort((a, b) => {
    const order = { P1: 0, P2: 1, P3: 2 };
    const byPriority = order[a.priority] - order[b.priority];
    if (byPriority !== 0) return byPriority;
    return b.ageMinutes - a.ageMinutes;
  });
  res.json({ reports, queue, queueItems });
});

router.patch("/reports/:id", (req, res) => {
  const row = db.select().from(schema.reports).where(eq(schema.reports.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  const status = String(req.body.status || row.status);
  db.update(schema.reports).set({ status }).where(eq(schema.reports.id, row.id)).run();
  logAuditEvent({
    type: "report_status_changed",
    actorId: (req as AuthRequest).userId!,
    targetType: "report",
    targetId: row.id,
    payload: { from: row.status, to: status },
  });
  res.json({ ok: true, status });
});

router.post("/reports/:id/assign", requireAdminPermission("canViewReports"), (req: AuthRequest, res) => {
  const row = db.select().from(schema.reports).where(eq(schema.reports.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  const assigneeId = String(req.body.assigneeId || req.userId || "");
  const assignee = db.select().from(schema.users).where(eq(schema.users.id, assigneeId)).get();
  if (!assignee) return res.status(404).json({ error: "Assignee not found" });
  db.update(schema.reports)
    .set({ assignedTo: assigneeId, assignedAt: new Date(), status: row.status === "pending" ? "in_review" : row.status })
    .where(eq(schema.reports.id, row.id))
    .run();
  logAuditEvent({
    type: "report_assigned",
    actorId: req.userId!,
    targetType: "report",
    targetId: row.id,
    payload: { assigneeId, assigneeUsername: assignee.username },
  });
  res.json({ ok: true });
});

router.post("/reports/:id/unassign", requireAdminPermission("canViewReports"), (req: AuthRequest, res) => {
  const row = db.select().from(schema.reports).where(eq(schema.reports.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  db.update(schema.reports)
    .set({ assignedTo: null, assignedAt: null, status: row.status === "in_review" ? "pending" : row.status })
    .where(eq(schema.reports.id, row.id))
    .run();
  logAuditEvent({
    type: "report_unassigned",
    actorId: req.userId!,
    targetType: "report",
    targetId: row.id,
  });
  res.json({ ok: true });
});

router.post("/reports/escalate-overdue", requireAdminPermission("canViewReports"), (req: AuthRequest, res) => {
  const { escalated, affected } = escalateOverdueReports(req.userId!);
  res.json({ ok: true, escalated, affected });
});

router.get("/withdrawals", requireAdminPermission("canViewFinance"), (_req, res) => {
  const rows = db
    .select()
    .from(schema.withdrawals)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((w) => {
      const user = db.select().from(schema.users).where(eq(schema.users.id, w.userId)).get();
      return { ...w, username: user?.username };
    });
  res.json({ withdrawals: rows });
});

router.patch("/withdrawals/:id", (req, res) => {
  const row = db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  const status = String(req.body.status || "paid");
  if (!["pending", "paid", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  db.update(schema.withdrawals).set({ status }).where(eq(schema.withdrawals.id, row.id)).run();
  logAuditEvent({
    type: "withdrawal_status_changed",
    actorId: (req as AuthRequest).userId!,
    targetType: "withdrawal",
    targetId: row.id,
    severity: status === "rejected" ? "warn" : "info",
    payload: { from: row.status, to: status },
  });
  res.json({ ok: true, status });
});

router.get("/permissions/me", (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const me = db.select().from(schema.users).where(eq(schema.users.id, req.userId)).get();
  const isOwner = isOwnerById(req.userId);
  const own = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, req.userId)).get();
  res.json({
    isOwner,
    permissions: {
      canViewUsers: isOwner || own?.canViewUsers || false,
      canViewReports: isOwner || own?.canViewReports || false,
      canViewOrders: isOwner || own?.canViewOrders || false,
      canViewChats: isOwner || own?.canViewChats || false,
      canViewFinance: isOwner || own?.canViewFinance || false,
      canManageStaff: isOwner || own?.canManageStaff || false,
      canUseBlacklist: isOwner || own?.canUseBlacklist || false,
    },
  });
});

router.get("/staff", ownerOnly, (_req, res) => {
  const users = db.select().from(schema.users).all();
  const admins = users
    .filter(
      (u) =>
        isOwnerById(u.id) ||
        (u.roleFlags || "")
          .split(",")
          .map((x) => x.trim())
          .includes("admin")
    )
    .map((u) => {
      const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get();
      const perms = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, u.id)).get();
      return {
        id: u.id,
        username: u.username,
        role: isOwnerById(u.id) ? "owner" : "admin",
        badgeHidden: profile?.staffBadgeHidden ?? false,
        permissions: perms || null,
      };
    });
  res.json({ ownerUsername: getOwnerUsername(), admins });
});

router.patch("/staff/:userId", ownerOnly, (req: AuthRequest, res) => {
  const targetId = req.params.userId as string;
  const user = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (isOwnerById(user.id)) return res.status(400).json({ error: "Owner role is fixed" });
  const makeAdmin = Boolean(req.body.makeAdmin);
  const base = (user.roleFlags || "cosplayer")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x !== "admin");
  if (makeAdmin) base.push("admin");
  const roleFlags = flagsForUsername(base.join(","), user.username);
  db.update(schema.users).set({ roleFlags }).where(eq(schema.users.id, targetId)).run();
  setStaffRole(targetId, makeAdmin ? "admin" : "none");
  if (!makeAdmin) {
    db.delete(schema.adminPermissions).where(eq(schema.adminPermissions.userId, targetId)).run();
  }
  logAuditEvent({
    type: makeAdmin ? "admin_granted" : "admin_revoked",
    actorId: req.userId!,
    targetType: "staff",
    targetId,
    severity: "high",
    payload: { username: user.username },
  });
  res.json({ ok: true, roleFlags });
});

router.patch("/staff/:userId/permissions", ownerOnly, (req: AuthRequest, res) => {
  const targetId = req.params.userId as string;
  const user = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const updated = upsertAdminPermissions(targetId, req.body || {}, req.userId);
  logAuditEvent({
    type: "admin_permissions_updated",
    actorId: req.userId!,
    targetType: "staff",
    targetId,
    severity: "high",
    payload: updated,
  });
  res.json({ ok: true, permissions: updated });
});

router.patch("/staff/:userId/badge", (req: AuthRequest, res) => {
  const targetId = req.params.userId as string;
  const hidden = Boolean(req.body.hidden);
  const actorId = req.userId!;
  const actor = db.select().from(schema.users).where(eq(schema.users.id, actorId)).get();
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  const targetUser = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  const actorOwner = isOwnerById(actor.id);
  if (!actorOwner && actorId !== targetId) return res.status(403).json({ error: "Cannot change other user badge" });
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, targetId)).get();
  if (profile) {
    db.update(schema.profiles).set({ staffBadgeHidden: hidden }).where(eq(schema.profiles.userId, targetId)).run();
  } else {
    db.insert(schema.profiles).values({ userId: targetId, staffBadgeHidden: hidden }).run();
  }
  logAuditEvent({
    type: "staff_badge_toggled",
    actorId,
    targetType: "user",
    targetId,
    payload: { hidden },
  });
  res.json({ ok: true, hidden });
});

router.get("/users", requireAdminPermission("canViewUsers"), (req: AuthRequest, res) => {
  const query = String(req.query.query || "").trim().toLowerCase();
  const reports = db.select().from(schema.reports).all();
  const audits = db.select().from(schema.auditEvents).all();
  const blocks = db.select().from(schema.blocks).all();
  const users = db.select().from(schema.users).all();
  const rows = users
    .map((u) => {
      const p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get();
      const reportsCount = reports.filter((r) => r.targetId === u.id).length;
      const profanityCount = audits.filter((a) => a.actorId === u.id && a.type === "profanity_detected").length;
      const highSeverityCount = audits.filter((a) => a.targetId === u.id && a.severity === "high").length;
      const autoBanCount = audits.filter((a) => a.targetId === u.id && a.type === "auto_temp_ban_applied").length;
      const blockedCount = blocks.filter((b) => b.blockedId === u.id).length;
      const activeBan = getActiveBan(u.id);
      const blockedActive = Boolean(activeBan);
      const violationsScore = reportsCount * 2 + profanityCount + highSeverityCount * 2 + blockedCount * 3;
      const ownerAccount = isOwnerById(u.id);
      const riskBucket = ownerAccount
        ? "clean"
        : blockedActive
          ? "blocked"
          : violationsScore >= 5
            ? "violator"
            : violationsScore >= 2
              ? "suspicious"
              : "clean";
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        displayName: p?.displayName || null,
        avatarUrl: p?.avatarUrl || null,
        staffRole: p?.staffRole || (ownerAccount ? "owner" : "none"),
        staffBadgeHidden: p?.staffBadgeHidden || false,
        blockedActive: ownerAccount ? false : blockedActive,
        activeBan: ownerAccount ? null : activeBan,
        riskBucket,
        ownerProtected: ownerAccount,
        indicators: ownerAccount
          ? {
              reportsCount: 0,
              profanityCount: 0,
              highSeverityCount: 0,
              autoBanCount: 0,
              blockedCount: 0,
              violationsScore: 0,
            }
          : {
              reportsCount,
              profanityCount,
              highSeverityCount,
              autoBanCount,
              blockedCount,
              violationsScore,
            },
      };
    })
    .filter((u) => !query || `${u.username} ${u.displayName || ""} ${u.email || ""} ${u.phone || ""}`.toLowerCase().includes(query))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 150);
  res.json({ users: rows });
});

router.post("/users/:id/unblock", requireAdminPermission("canViewUsers"), (req: AuthRequest, res) => {
  const userId = req.params.id as string;
  const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!target) return res.status(404).json({ error: "User not found" });
  db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId)).run();
  logAuditEvent({
    type: "user_unblocked",
    actorId: req.userId!,
    targetType: "user",
    targetId: userId,
    severity: "high",
    payload: { username: target.username },
  });
  res.json({ ok: true });
});

router.get("/users/:id/summary", requireAdminPermission("canViewUsers"), (req, res) => {
  const userId = req.params.id as string;
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  const messages = db.select().from(schema.messages).where(eq(schema.messages.senderId, userId)).all();
  const reports = db.select().from(schema.reports).where(eq(schema.reports.targetId, userId)).all();
  const orders = db.select().from(schema.orders).where(or(eq(schema.orders.makerId, userId), eq(schema.orders.clientId, userId))).all();
  const auditsByTarget = db.select().from(schema.auditEvents).where(eq(schema.auditEvents.targetId, userId)).all();
  const auditsByActor = db.select().from(schema.auditEvents).where(eq(schema.auditEvents.actorId, userId)).all();

  const topChats = Object.entries(
    messages.reduce<Record<string, number>>((acc, m) => {
      acc[m.conversationId] = (acc[m.conversationId] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([conversationId, count]) => {
      const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).get();
      const channel = db.select().from(schema.channels).where(eq(schema.channels.conversationId, conversationId)).get();
      const memberRows = db
        .select()
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, conversationId))
        .all();
      const sampleMessages = db
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.conversationId, conversationId), eq(schema.messages.senderId, userId)))
        .all()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          text: m.text || (m.type === "image" ? "Фото" : m.type === "voice" ? "Голосовое" : m.type === "file" ? "Файл" : m.type || ""),
          createdAt: m.createdAt,
          type: m.type,
        }));

      let title = conversationId;
      let openPath = `/messages?c=${encodeURIComponent(conversationId)}`;
      let kind: "channel" | "dm" | "group" = "dm";
      if (channel) {
        title = channel.title;
        openPath = `/messages?tab=channels&c=${encodeURIComponent(channel.id)}`;
        kind = "channel";
      } else if (conv?.type === "dm") {
        const other = memberRows.find((m) => m.userId !== userId);
        if (other) {
          const otherUser = db.select().from(schema.users).where(eq(schema.users.id, other.userId)).get();
          if (otherUser) title = `Диалог с @${otherUser.username}`;
        }
      } else if (conv?.type === "group") {
        kind = "group";
        title = `Групповой чат (${memberRows.length})`;
      }

      return { conversationId, count, title, kind, openPath, sampleMessages };
    });

  const profane = auditsByActor.filter((e) => e.type === "profanity_detected");
  const deleted = auditsByActor.filter((e) => e.type.includes("delete"));
  const suspicious = [...auditsByTarget, ...auditsByActor].filter((e) => e.severity === "high");
  const riskScore = reports.length * 2 + profane.length * 2 + suspicious.length * 3 + deleted.length;
  const riskLevel = riskScore >= 9 ? "high" : riskScore >= 4 ? "medium" : "low";
  const ownerAccount = isOwnerById(user.id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      roleFlags: user.roleFlags,
      createdAt: user.createdAt,
      profile: profile || null,
    },
    topChats,
    orders: {
      total: orders.length,
      byStatus: orders.reduce<Record<string, number>>((acc, x) => {
        const key = x.status || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      latest: orders.slice(-5).reverse(),
    },
    violations: ownerAccount
      ? {
          reportsTotal: 0,
          reportsByStatus: {},
          profanityCount: 0,
          profanityExamples: [],
          suspiciousCount: 0,
          deletedActionsCount: 0,
        }
      : {
          reportsTotal: reports.length,
          reportsByStatus: reports.reduce<Record<string, number>>((acc, x) => {
            const key = x.status || "unknown";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {}),
          profanityCount: profane.length,
          profanityExamples: profane.slice(-5).map((e) => ({ createdAt: e.createdAt, payload: e.payloadJson })),
          suspiciousCount: suspicious.length,
          deletedActionsCount: deleted.length,
        },
    risk: ownerAccount ? { score: 0, level: "low" as const } : { score: riskScore, level: riskLevel },
    ownerProtected: ownerAccount,
  });
});

const PLATFORM_ROLES = new Set(["client", "blogger", "seller"]);

router.get("/role-change-requests", requireAdminPermission("canViewUsers"), (req, res) => {
  const status = String((req.query.status as string) || "pending");
  let rows = db.select().from(schema.moderationRequests).all();
  if (status !== "all") {
    rows = rows.filter((r) => r.status === status);
  }
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const requests = rows.map((r) => {
    const u = db.select().from(schema.users).where(eq(schema.users.id, r.userId)).get();
    const p = u ? db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).get() : null;
    return {
      ...r,
      username: u?.username,
      displayName: p?.displayName,
    };
  });
  res.json({ requests });
});

router.post("/role-change-requests/:id/approve", requireAdminPermission("canViewUsers"), (req: AuthRequest, res) => {
  const row = db.select().from(schema.moderationRequests).where(eq(schema.moderationRequests.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "pending") return res.status(400).json({ error: "Заявка уже обработана" });
  if (!PLATFORM_ROLES.has(row.requestedRole)) {
    return res.status(400).json({ error: "Недопустимая роль в заявке" });
  }

  db.update(schema.users)
    .set({ platformRole: row.requestedRole })
    .where(eq(schema.users.id, row.userId))
    .run();
  db.update(schema.moderationRequests)
    .set({
      status: "approved",
      reviewerId: req.userId!,
      reviewNote: String(req.body.note || "") || null,
      reviewedAt: new Date(),
    })
    .where(eq(schema.moderationRequests.id, row.id))
    .run();

  try {
    db.insert(schema.notifications)
      .values({
        id: uuid(),
        userId: row.userId,
        type: "role_change",
        payloadJson: JSON.stringify({
          text: `Заявка на роль «${row.requestedRole}» одобрена`,
          status: "approved",
          requestedRole: row.requestedRole,
        }),
        read: false,
      })
      .run();
  } catch {
    /* notifications optional */
  }

  logAuditEvent({
    actorId: req.userId!,
    type: "role_change_approve",
    targetType: "user",
    targetId: row.userId,
    severity: "warn",
    payload: { requestId: row.id, from: row.currentRole, to: row.requestedRole },
  });

  res.json({ ok: true });
});

router.post("/role-change-requests/:id/reject", requireAdminPermission("canViewUsers"), (req: AuthRequest, res) => {
  const row = db.select().from(schema.moderationRequests).where(eq(schema.moderationRequests.id, req.params.id as string)).get();
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "pending") return res.status(400).json({ error: "Заявка уже обработана" });

  db.update(schema.moderationRequests)
    .set({
      status: "rejected",
      reviewerId: req.userId!,
      reviewNote: String(req.body.note || "") || null,
      reviewedAt: new Date(),
    })
    .where(eq(schema.moderationRequests.id, row.id))
    .run();

  try {
    db.insert(schema.notifications)
      .values({
        id: uuid(),
        userId: row.userId,
        type: "role_change",
        payloadJson: JSON.stringify({
          text: `Заявка на роль «${row.requestedRole}» отклонена`,
          status: "rejected",
          requestedRole: row.requestedRole,
          note: req.body.note || "",
        }),
        read: false,
      })
      .run();
  } catch {
    /* optional */
  }

  logAuditEvent({
    actorId: req.userId!,
    type: "role_change_reject",
    targetType: "user",
    targetId: row.userId,
    severity: "warn",
    payload: { requestId: row.id, from: row.currentRole, to: row.requestedRole },
  });

  res.json({ ok: true });
});

export default router;
