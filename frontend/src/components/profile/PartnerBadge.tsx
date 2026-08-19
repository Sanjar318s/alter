"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { partners } from "@/lib/api";

export function PartnerBadge({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<{ partnerSlug: string; badgeLabel: string }[]>([]);

  useEffect(() => {
    if (!userId) return;
    partners
      .makerBadges(userId)
      .then((r) => setBadges(r.badges))
      .catch(() => setBadges([]));
  }, [userId]);

  if (!badges.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {badges.map((b) => (
        <Link
          key={b.partnerSlug + b.badgeLabel}
          href={`/partners/${b.partnerSlug}`}
          className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 border border-magenta/50 text-magenta no-underline hover:bg-magenta/10"
        >
          {b.badgeLabel}
        </Link>
      ))}
    </div>
  );
}
