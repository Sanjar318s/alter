"use client";

import { coverCropStyle, coverSources, type CoverCropMap } from "@/lib/coverCrop";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";

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

  if (hasVariants) {
    return (
      <picture className={cn("profile-cover-picture", "profile-cover-picture--variants")}>
        <source media="(max-width: 768px)" srcSet={mobile} />
        <source media="(max-width: 1023px)" srcSet={tablet} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={desktop} alt={alt} className={className} loading="eager" decoding="async" />
      </picture>
    );
  }

  return <SmartImage src={coverUrl} alt={alt} className={className} style={legacyStyle} />;
}
