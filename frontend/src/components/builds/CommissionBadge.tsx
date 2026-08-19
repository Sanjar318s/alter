"use client";

import { Badge } from "@/components/ui/Badge";

export function CommissionBadge({ status }: { status?: string | null }) {
  const s = status === "waitlist" || status === "closed" || status === "open" ? status : "closed";
  return <Badge status={s} />;
}
