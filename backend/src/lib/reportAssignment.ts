import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isOwnerUsername } from "./owner";
import { logAuditEvent } from "./audit";

const MAX_ACTIVE_CASES_PER_MODERATOR = 25;

function isAdminRole(roleFlags?: string | null) {
  return (roleFlags || "")
    .split(",")
    .map((x) => x.trim())
    .includes("admin");
}

function canHandleReports(userId: string, username: string, roleFlags?: string | null) {
  if (isOwnerUsername(username)) return true;
  if (!isAdminRole(roleFlags)) return false;
  const perms = db.select().from(schema.adminPermissions).where(eq(schema.adminPermissions.userId, userId)).get();
  return Boolean(perms?.canViewReports);
}

export function autoAssignReport(reportId: string) {
  const report = db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).get();
  if (!report) return null;
  if (report.assignedTo) return report.assignedTo;

  const users = db.select().from(schema.users).all();
  const candidates = users.filter((u) => canHandleReports(u.id, u.username, u.roleFlags));
  if (!candidates.length) return null;

  const scored = candidates
    .map((u) => {
      const assigned = db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.assignedTo, u.id))
        .all()
        .filter((r) => r.status === "pending" || r.status === "in_review");
      const inReviewCount = assigned.filter((r) => r.status === "in_review").length;
      const activeCount = assigned.length;
      const lastAssignedAt = assigned
        .map((r) => (r.assignedAt ? new Date(r.assignedAt).getTime() : 0))
        .sort((a, b) => b - a)[0] || 0;
      return { user: u, inReviewCount, activeCount, lastAssignedAt };
    })
    .filter((x) => x.activeCount < MAX_ACTIVE_CASES_PER_MODERATOR)
    .sort((a, b) => {
      if (a.inReviewCount !== b.inReviewCount) return a.inReviewCount - b.inReviewCount;
      if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
      return a.lastAssignedAt - b.lastAssignedAt;
    });

  const pick = scored[0];
  if (!pick) return null;

  db.update(schema.reports)
    .set({ assignedTo: pick.user.id, assignedAt: new Date(), status: report.status === "pending" ? "in_review" : report.status })
    .where(eq(schema.reports.id, reportId))
    .run();

  logAuditEvent({
    type: "report_auto_assigned",
    actorId: pick.user.id,
    targetType: "report",
    targetId: reportId,
    payload: {
      assigneeId: pick.user.id,
      assigneeUsername: pick.user.username,
      inReviewCount: pick.inReviewCount,
      activeCount: pick.activeCount,
      maxActiveCases: MAX_ACTIVE_CASES_PER_MODERATOR,
    },
  });

  return pick.user.id;
}
