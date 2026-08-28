import type { CSSProperties } from "react";

/** Editor / export aspect ratios — keep in sync with profile display CSS. */
export const COVER_DEVICE_ASPECT = {
  desktop: 16 / 5,
  tablet: 16 / 6,
  /** Matches typical mobile profile header band (~1.25:1), not 2:1. */
  mobile: 5 / 4,
} as const;

/** Tablet/mobile variant URLs. Desktop uses `coverUrl`. */
export type CoverCropMap = {
  tablet?: string;
  mobile?: string;
  /** @deprecated legacy object-position values */
  desktop?: string;
};

export function parseCoverCropJson(raw?: string | null): CoverCropMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CoverCropMap;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function isCoverAssetUrl(value?: string): boolean {
  if (!value) return false;
  return value.startsWith("http") || value.startsWith("/");
}

function isLegacyPosition(value?: string): boolean {
  return Boolean(value && value.includes("%"));
}

export function coverCropStyle(crops: CoverCropMap): CSSProperties | undefined {
  if (isCoverAssetUrl(crops.tablet) || isCoverAssetUrl(crops.mobile)) return undefined;
  const desktop = crops.desktop || "50% 35%";
  const tablet = isLegacyPosition(crops.tablet) ? crops.tablet! : desktop;
  const mobile = isLegacyPosition(crops.mobile) ? crops.mobile! : tablet;
  return {
    ["--cover-pos-desktop" as string]: desktop,
    ["--cover-pos-tablet" as string]: tablet,
    ["--cover-pos-mobile" as string]: mobile,
  };
}

export function coverSources(coverUrl: string | null, crops: CoverCropMap) {
  const desktop = coverUrl || "";
  const tablet = isCoverAssetUrl(crops.tablet) ? crops.tablet! : desktop;
  const mobile = isCoverAssetUrl(crops.mobile) ? crops.mobile! : tablet;
  return { desktop, tablet, mobile, hasVariants: isCoverAssetUrl(crops.tablet) || isCoverAssetUrl(crops.mobile) };
}
