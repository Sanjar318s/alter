"use client";

import { coverCropStyle, coverSources, type CoverCropMap } from "@/lib/coverCrop";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";
import { mediaSrc } from "@/lib/format";

export function ProfileCoverArt({
  coverUrl,
  crops = {},
  className = "profile-cover-image",
  alt = "",
}: {
  coverUrl: string | null;
  crops?: CoverCropMap;
  className?: string;
  alt?: string;
}) {
  if (!coverUrl) return null;

  const { desktop, tablet, mobile, hasVariants } = coverSources(coverUrl, crops);
  const legacyStyle = coverCropStyle(crops);
  const desktopSrc = mediaSrc(desktop);
  const tabletSrc = mediaSrc(tablet);
  const mobileSrc = mediaSrc(mobile);
  const versionKey = `${desktopSrc}|${tabletSrc}|${mobileSrc}`;

  if (hasVariants) {
    return (
      <picture key={versionKey} className={cn("profile-cover-picture", "profile-cover-picture--variants")}>
        <source media="(max-width: 768px)" srcSet={mobileSrc} />
        <source media="(max-width: 1023px)" srcSet={tabletSrc} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={desktopSrc} alt={alt} className={className} loading="eager" decoding="async" />
      </picture>
    );
  }

  return <SmartImage src={coverUrl} alt={alt} className={className} style={legacyStyle} />;
}
