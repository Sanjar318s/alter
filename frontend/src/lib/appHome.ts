import type { PlatformRole } from "@/lib/AuthContext";

/** Main app feed for users who already chose a platform role. */
export const APP_FEED_HOME = "/reels";

export function homePathForUser(user: { platformRole?: PlatformRole | null } | null | undefined): string {
  if (user?.platformRole) return APP_FEED_HOME;
  return "/";
}
