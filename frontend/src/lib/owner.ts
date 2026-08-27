/** Owner nick: mirrors backend/src/lib/owner.ts */
export const ADMIN_USERNAME = "nyx.cosplay";

export function isOwnerUsername(username?: string | null) {
  return (username || "").trim().toLowerCase() === ADMIN_USERNAME;
}

export function isPlatformOwnerUser(user: { username?: string | null } | null | undefined) {
  return isOwnerUsername(user?.username);
}
