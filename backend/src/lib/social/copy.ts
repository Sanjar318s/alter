import { BASE_HASHTAGS, SITE_URL, SOCIAL_FOOTER_RU } from "./constants";

export type PublicationCopyInput = {
  caption?: string | null;
  tags?: string[] | null;
  username: string;
};

export type BuildCopyInput = {
  title?: string | null;
  description?: string | null;
  franchise?: string | null;
  character?: string | null;
  tags?: string[] | null;
  username: string;
  buildId?: string;
};

function slugTag(raw: string) {
  const cleaned = raw
    .replace(/^#/, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u0400-\u04FF]/g, "");
  if (!cleaned) return null;
  return `#${cleaned}`;
}

function collectHashtags(...sources: Array<string | null | undefined | string[]>) {
  const out: string[] = [...BASE_HASHTAGS];
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const t of src) {
        const tag = slugTag(String(t));
        if (tag) out.push(tag);
      }
    } else {
      const fromHashes = String(src).match(/#[\w\u0400-\u04FF]+/g) || [];
      for (const h of fromHashes) out.push(h);
      const asTag = slugTag(String(src));
      if (asTag && !String(src).includes("#")) out.push(asTag);
    }
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of out) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
    if (unique.length >= 25) break;
  }
  return unique;
}

export function buildDescription(
  kind: "publication" | "build",
  input: (PublicationCopyInput | BuildCopyInput) & { buildId?: string }
): { title: string; description: string; hashtags: string[] } {
  if (kind === "publication") {
    const p = input as PublicationCopyInput;
    const caption = (p.caption || "").trim();
    const hashtags = collectHashtags(caption, p.tags);
    const title = caption.slice(0, 90) || `Cosplay · @${p.username}`;
    const description = [caption, "", hashtags.join(" "), "", SOCIAL_FOOTER_RU(p.username)]
      .join("\n")
      .trim()
      .slice(0, 2200);
    return { title, description, hashtags };
  }

  const b = input as BuildCopyInput;
  const title = (b.title || b.character || "Cosplay").slice(0, 90);
  const hashtags = collectHashtags(b.tags, b.franchise, b.character, b.description);
  const mid = [
    b.title || "",
    b.character && b.franchise ? `${b.character} · ${b.franchise}` : b.character || b.franchise || "",
    (b.description || "").trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const link = b.buildId ? `Работа: ${SITE_URL}/build/${b.buildId}` : "";
  const description = [mid, link, "", hashtags.join(" "), "", SOCIAL_FOOTER_RU(b.username)]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim()
    .slice(0, 2200);
  return { title, description, hashtags };
}
