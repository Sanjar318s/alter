import type { CSSProperties } from "react";

export type CoverCropMap = {
  desktop?: string;
  tablet?: string;
  mobile?: string;
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

export function coverCropStyle(crops: CoverCropMap): CSSProperties {
  const desktop = crops.desktop || "50% 35%";
  const tablet = crops.tablet || desktop;
  const mobile = crops.mobile || tablet;
  return {
    ["--cover-pos-desktop" as string]: desktop,
    ["--cover-pos-tablet" as string]: tablet,
    ["--cover-pos-mobile" as string]: mobile,
  };
}
