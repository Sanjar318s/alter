"use client";

import Link from "next/link";
import { Heart, Images } from "lucide-react";
import { SmartImage } from "@/components/media/SmartImage";
import { CommissionBadge } from "./CommissionBadge";
import { formatCount } from "@/lib/format";
import { Frame } from "@/components/Frame";

export function BuildCard({
  id,
  title,
  character,
  cover,
  status,
  likes,
  photos,
}: {
  id: string;
  title: string;
  character?: string;
  cover?: string | null;
  status?: string | null;
  likes?: number;
  photos?: number;
}) {
  return (
    <Link href={`/build/${id}`} className="block no-underline text-paper group">
      <Frame hover className="relative aspect-[4/5] overflow-hidden bg-stage">
        <SmartImage src={cover} alt={character || title} fallback={title} />
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink via-ink/70 to-transparent">
          <div className="font-display font-extrabold text-[16px] leading-tight">{character || title}</div>
          <div className="flex items-center gap-2 mt-1.5">
            {status === "open" || status === "waitlist" ? <CommissionBadge status={status} /> : null}
            <span className="font-mono text-[10px] text-ink-45 inline-flex items-center gap-1">
              <Heart size={10} /> {formatCount(likes || 0)}
            </span>
            <span className="font-mono text-[10px] text-ink-45 inline-flex items-center gap-1">
              <Images size={10} /> {photos || 1}
            </span>
          </div>
        </div>
      </Frame>
    </Link>
  );
}
