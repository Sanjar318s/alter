export type StaffRole = "none" | "owner" | "admin";

export function isOwnerStaffRole(staffRole?: string | null): staffRole is "owner" {
  return staffRole === "owner";
}

export function isPlatformOwnerUser(
  user: { staffRole?: string | null; username?: string | null } | null | undefined
) {
  return isOwnerStaffRole(user?.staffRole);
}

export function isAdminUser(
  user: { roleFlags?: string | null; staffRole?: string | null } | null | undefined
) {
  if (!user) return false;
  if (isPlatformOwnerUser(user)) return true;
  return (user.roleFlags || "")
    .split(",")
    .map((s) => s.trim())
    .includes("admin");
}

/** Profile subject is the platform owner account. */
export function isOwnerProfile(profile?: { staffRole?: string | null } | null) {
  return isOwnerStaffRole(profile?.staffRole);
}
