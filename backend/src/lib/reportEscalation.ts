import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db";
import { isOwnerUsername } from "./owner";
import { logAuditEvent } from "./audit";
import { getModerationSettings } from "./moderationSettings";

type ReportLike = { id: string; targetType: string; reason: string; details?: string | null; status: string; createdAt: Date };

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

function wasEscalatedRecently(reportId: string, withinMs: number) {
  const events = db
    .select()
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.type, "report_escalated_overdue"), eq(schema.auditEvents.targetId, reportId)))
    .all();
  const threshold = Date.now() - withinMs;
  return events.some((e) => new Date(e.createdAt).getTime() >= threshold);
}

function reportWatcherIds() {
  const users = db.select().from(schema.users).all();
  const ids = new Set<string>();
  for (const u of users) {
    if (isOwnerUsername(u.username)) {
      ids.add(u.id);
      continue;
    }
    const isAdmin = (u.roleFlags || "")
      .split(",")
      .map((x) => x.trim())
      .includes("admin");
    if (!isAdmin) continue;
    const perms = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, u.id)).get();
    if (perms?.canViewReports) ids.add(u.id);
  }
  return Array.from(ids);
}

export function escalateOverdueReports(actorId?: string | null) {
  const settings = getModerationSettings();
  if (!settings.autoEscalateEnabled && !actorId) return { escalated: 0, affected: [] as string[] };
  const all = db.select().from(schema.reports).all() as ReportLike[];
  const candidates = all
    .filter((r) => r.status === "pending" || r.status === "in_review")
    .map((r) => ({ report: r, meta: reportPriorityMeta(r) }))
    .filter((x) => x.meta.overdue && (x.meta.priority === "P1" || x.meta.priority === "P2"));

  const watchers = reportWatcherIds();
  let escalated = 0;
  const affected: string[] = [];

  for (const item of candidates) {
    if (wasEscalatedRecently(item.report.id, settings.escalationCooldownMs)) continue;
    escalated += 1;
    affected.push(item.report.id);
    logAuditEvent({
      type: "report_escalated_overdue",
      actorId: actorId || null,
      targetType: "report",
      targetId: item.report.id,
      severity: "high",
      payload: {
        priority: item.meta.priority,
        ageMinutes: item.meta.ageMinutes,
        slaMinutes: item.meta.slaMinutes,
        overdue: true,
        status: item.report.status,
      },
    });

    for (const userId of watchers) {
      db.insert(schema.notifications)
        .values({
          id: uuid(),
          userId,
          type: "report_escalated_overdue",
          payloadJson: JSON.stringify({
            reportId: item.report.id,
            priority: item.meta.priority,
            ageMinutes: item.meta.ageMinutes,
            slaMinutes: item.meta.slaMinutes,
            status: item.report.status,
          }),
        })
        .run();
    }
  }
  return { escalated, affected };
}
