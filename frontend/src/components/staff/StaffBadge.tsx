"use client";

import { cn } from "@/lib/cn";

export function StaffBadge({ role, hidden }: { role?: string | null; hidden?: boolean }) {
  if (hidden) return null;
  if (role !== "owner" && role !== "admin") return null;
  const isOwner = role === "owner";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wide",
        isOwner ? "bg-magenta/20 text-magenta border border-magenta/50" : "bg-amber/20 text-amber border border-amber/50"
      )}
    >
      {isOwner ? "OWNER" : "ADMIN"}
    </span>
  );
}
