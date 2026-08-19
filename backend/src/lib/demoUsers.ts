/** Demo accounts created by db/seed.ts — safe to purge in production. */
export const DEMO_USER_IDS = new Set(["u-nyx", "u-luna", "u-victor", "u-raiden"]);

export const DEMO_USERNAMES = new Set(["demo.nyx", "luna.s", "victor.maker", "raiden.photo"]);

export const DEMO_BUILD_IDS = new Set([
  "jinx",
  "raiden",
  "miku",
  "2b",
  "cloud",
  "yae",
  "makima",
  "albedo",
  "dva",
  "nezuko",
  "levi",
  "maria",
]);

export function isDemoUser(user: { id: string; email?: string | null; username?: string | null }) {
  if (DEMO_USER_IDS.has(user.id)) return true;
  const username = (user.username || "").trim().toLowerCase();
  if (username.startsWith("parked.") || username.startsWith("demo.")) return true;
  if (DEMO_USERNAMES.has(username)) return true;
  const email = (user.email || "").trim().toLowerCase();
  if (!email) return false;
  if (email.endsWith("@phone.alter.local")) return false;
  return email.endsWith("@alter.local");
}
