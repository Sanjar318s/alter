import { realtime } from "../routes/realtime";
import { getUserStats } from "./userStats";

export function pushStats(userId: string) {
  const row = getUserStats(userId);
  if (!row) return;
  realtime.send(userId, { event: "stats", data: row });
}

export function pushNotification(userId: string, payload: Record<string, unknown>) {
  realtime.send(userId, { event: "notification", data: payload });
}
