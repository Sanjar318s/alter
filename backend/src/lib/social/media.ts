const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

export function guessMimeFromUrl(url: string): string | null {
  if (IMAGE_EXT.test(url)) {
    if (/\.png/i.test(url)) return "image/png";
    if (/\.webp/i.test(url)) return "image/webp";
    if (/\.gif/i.test(url)) return "image/gif";
    return "image/jpeg";
  }
  if (VIDEO_EXT.test(url)) {
    if (/\.webm/i.test(url)) return "video/webm";
    return "video/mp4";
  }
  return null;
}

export function isLikelyVideoUrl(url: string) {
  return VIDEO_EXT.test(url) || /video/i.test(url);
}

export function isLikelyImageUrl(url: string) {
  return IMAGE_EXT.test(url);
}

export type MediaPick = {
  primaryUrl: string | null;
  coverUrl: string | null;
  isVideo: boolean;
};

/** Prefer first media; for video also surface a cover image if present in the list. */
export function pickMedia(urls: string[], coverHint?: string | null): MediaPick {
  const list = (urls || []).filter(Boolean);
  const primary = list[0] || coverHint || null;
  if (!primary) return { primaryUrl: null, coverUrl: coverHint || null, isVideo: false };
  const isVideo = isLikelyVideoUrl(primary);
  const cover =
    coverHint ||
    list.find((u) => isLikelyImageUrl(u)) ||
    (!isVideo ? primary : null);
  return { primaryUrl: primary, coverUrl: cover, isVideo };
}

const MAX_INLINE_BYTES = 4 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;

export async function fetchBuffer(
  url: string,
  opts?: { maxBytes?: number }
): Promise<{ buffer: Buffer; mime: string }> {
  const maxBytes = opts?.maxBytes ?? MAX_DOWNLOAD_BYTES;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    guessMimeFromUrl(url) ||
    "application/octet-stream";
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > maxBytes) throw new Error("too_large");
  const ab = await res.arrayBuffer();
  if (ab.byteLength > maxBytes) throw new Error("too_large");
  return { buffer: Buffer.from(ab), mime };
}

export async function fetchImageInlineBase64(url: string): Promise<{ mime: string; data: string } | null> {
  try {
    const { buffer, mime } = await fetchBuffer(url, { maxBytes: MAX_INLINE_BYTES });
    if (!mime.startsWith("image/")) return null;
    return { mime, data: buffer.toString("base64") };
  } catch {
    return null;
  }
}
