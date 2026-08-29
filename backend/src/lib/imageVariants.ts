import sharp from "sharp";
import { putUpload } from "./storage";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageVariantUrls = {
  url: string;
  cardUrl?: string;
  thumbUrl?: string;
};

function baseName(filename: string) {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** Store original + card (480w) + thumb (240w) WebP for list/grid speed. */
export async function putImageWithVariants(
  filename: string,
  body: Buffer,
  contentType: string
): Promise<ImageVariantUrls & { driver: "r2" | "local" }> {
  const stored = await putUpload(filename, body, contentType);
  if (!IMAGE_MIME.has(contentType)) {
    return { url: stored.url, driver: stored.driver };
  }

  const stem = baseName(filename);
  try {
    const pipeline = sharp(body, { failOn: "none" }).rotate();
    const [cardBuf, thumbBuf] = await Promise.all([
      pipeline
        .clone()
        .resize({ width: 480, height: 600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72, effort: 4 })
        .toBuffer(),
      pipeline
        .clone()
        .resize({ width: 240, height: 300, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 68, effort: 4 })
        .toBuffer(),
    ]);

    const [card, thumb] = await Promise.all([
      putUpload(`${stem}-card.webp`, cardBuf, "image/webp"),
      putUpload(`${stem}-thumb.webp`, thumbBuf, "image/webp"),
    ]);

    return {
      url: stored.url,
      cardUrl: card.url,
      thumbUrl: thumb.url,
      driver: stored.driver,
    };
  } catch (err) {
    console.warn("[imageVariants] skip variants:", err instanceof Error ? err.message : err);
    return { url: stored.url, driver: stored.driver };
  }
}

/** Derive card/thumb URL from an original upload path (naming convention). */
export function variantUrl(originalUrl: string, size: "card" | "thumb"): string | null {
  if (!originalUrl || originalUrl.startsWith("blob:") || originalUrl.startsWith("data:")) return null;
  try {
    const u = originalUrl.startsWith("http") ? new URL(originalUrl) : null;
    const path = u ? u.pathname : originalUrl.split("?")[0];
    const m = path.match(/^(.*\/)?([^/]+?)(\.[a-z0-9]+)?$/i);
    if (!m) return null;
    const dir = m[1] || "";
    const stem = m[2];
    if (/-card$/i.test(stem) || /-thumb$/i.test(stem)) return null;
    const next = `${dir}${stem}-${size}.webp`;
    if (u) {
      u.pathname = next;
      return u.toString();
    }
    const q = originalUrl.includes("?") ? originalUrl.slice(originalUrl.indexOf("?")) : "";
    return next + q;
  } catch {
    return null;
  }
}
