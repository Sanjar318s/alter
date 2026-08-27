import type { PlatformRole } from "@/lib/AuthContext";
import { isPlatformOwnerUser } from "@/lib/owner";

/** Main app feed for users who already chose a platform role (or platform owner). */
export const APP_FEED_HOME = "/reels";

export function homePathForUser(
  user: { username?: string | null; platformRole?: PlatformRole | null } | null | undefined
): string {
  if (isPlatformOwnerUser(user) || user?.platformRole) return APP_FEED_HOME;
  return "/";
}
