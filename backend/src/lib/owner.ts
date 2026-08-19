/** Owner nick: this account gets the admin panel. Seed demo must not occupy it. */
export const ADMIN_USERNAME = "nyx.cosplay";

export function isOwnerUsername(username?: string | null) {
  return (username || "").trim().toLowerCase() === ADMIN_USERNAME;
}

export function normalizeUsername(username: string) {
  const trimmed = username.trim();
  return isOwnerUsername(trimmed) ? ADMIN_USERNAME : trimmed;
}

export function isAdminUser(user: { username?: string | null; roleFlags?: string | null } | null | undefined) {
  if (!user) return false;
  if (isOwnerUsername(user.username)) return true;
  return (user.roleFlags || "")
    .split(",")
    .map((s) => s.trim())
    .includes("admin");
}

/** Client cannot self-grant admin. Owner nick always gets it. */
export function flagsForUsername(roleFlags: string | undefined, username: string) {
  const parts = (roleFlags || "cosplayer")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "admin");
  if (isOwnerUsername(username)) parts.push("admin");
  return [...new Set(parts)].join(",") || "cosplayer";
}
