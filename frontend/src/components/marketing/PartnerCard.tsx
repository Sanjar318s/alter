"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";
import type { AdPlacementResponse } from "@/lib/api";
import { trackPlacement } from "@/lib/placements";

type Placement = NonNullable<AdPlacementResponse["placement"]>;

export function PartnerCard({
  placement,
  compact,
  onClickTrack,
}: {
  placement: Placement;
  compact?: boolean;
  onClickTrack?: () => void;
}) {
  const { creative, partner, placementId } = placement;
  const href = creative.ctaUrl || `/partners/${creative.partnerSlug || partner.slug}`;

  useEffect(() => {
    trackPlacement(placementId, "impression");
  }, [placementId]);

  return (
    <Link
      href={href}
      onClick={() => {
        trackPlacement(placementId, "click");
        onClickTrack?.();
      }}
      className="block no-underline text-paper group"
    >
      <Frame
        hover
        className={`relative overflow-hidden border border-dashed border-magenta/50 bg-gradient-to-br from-magenta/[0.08] to-amber/[0.04] ${
          compact ? "aspect-[4/5]" : "min-h-[140px]"
        }`}
      >
        {creative.imageUrl ? (
          <SmartImage src={creative.imageUrl} alt={creative.title} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent z-[1]" />
        <span className="absolute top-2 right-2 z-[2] font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 bg-magenta/90 text-paper">
          Партнёр
        </span>
        <div className={`relative z-[2] flex flex-col justify-end h-full p-3 ${compact ? "min-h-[200px]" : ""}`}>
          <div className="font-display font-extrabold text-[14px] leading-tight">{creative.title || partner.name}</div>
          {creative.subtitle && (
            <div className="text-[12px] text-ink-70 mt-1 line-clamp-2">{creative.subtitle}</div>
          )}
          <div className="flex items-center gap-1 mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-magenta">
            {creative.ctaLabel || "Подробнее"}
            <ArrowUpRight size={12} />
          </div>
        </div>
      </Frame>
    </Link>
  );
}
