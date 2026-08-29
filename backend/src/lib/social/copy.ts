import {
  ALTER_COSPLAY_PITCH_RU,
  BASE_HASHTAGS,
  SITE_URL,
  authorSpotlightBlock,
} from "./constants";

export type SocialMention = {
  username?: string | null;
  displayName?: string | null;
  type?: string | null;
};

export type PublicationCopyInput = {
  caption?: string | null;
  tags?: string[] | null;
  username: string;
  bio?: string | null;
  socialLinks?: Record<string, string> | null;
  mentions?: SocialMention[] | null;
};

export type BuildCopyInput = {
  title?: string | null;
  description?: string | null;
  franchise?: string | null;
  character?: string | null;
  tags?: string[] | null;
  username: string;
  buildId?: string;
  bio?: string | null;
  socialLinks?: Record<string, string> | null;
  mentions?: SocialMention[] | null;
};

const DESC_MAX = 4900;

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

function mentionsBlock(mentions?: SocialMention[] | null): string {
  if (!mentions?.length) return "";
  const lines: string[] = ["Соавторы и отмеченные:"];
  const seen = new Set<string>();
  for (const m of mentions) {
    const uname = (m.username || "").replace(/^@/, "").trim();
    const label = (m.displayName || uname || "").trim();
    if (!label) continue;
    const key = (uname || label).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (uname) {
      lines.push(`• @${uname} → ${SITE_URL}/profile/${encodeURIComponent(uname)}`);
    } else {
      lines.push(`• ${label}`);
    }
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

function joinBlocks(parts: Array<string | null | undefined>) {
  return parts
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()
    .slice(0, DESC_MAX);
}

export function buildDescription(
  kind: "publication" | "build",
  input: (PublicationCopyInput | BuildCopyInput) & { buildId?: string }
): { title: string; description: string; hashtags: string[] } {
  const username = input.username;
  const bio = "bio" in input ? input.bio : null;
  const socialLinks = "socialLinks" in input ? input.socialLinks : null;
  const mentions = "mentions" in input ? input.mentions : null;
  const coauthors = mentionsBlock(mentions);
  const authorBlock = authorSpotlightBlock({
    username,
    bio,
    socialLinks,
  });

  if (kind === "publication") {
    const p = input as PublicationCopyInput;
    const caption = (p.caption || "").trim();
    const hashtags = collectHashtags(caption, p.tags);
    const title = caption.slice(0, 90) || `Cosplay · @${p.username}`;
    const description = joinBlocks([
      ALTER_COSPLAY_PITCH_RU,
      authorBlock,
      caption,
      coauthors,
      hashtags.join(" "),
    ]);
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
  const workLink = b.buildId ? `Работа на AlterCosPlay: ${SITE_URL}/build/${b.buildId}` : "";
  const description = joinBlocks([
    ALTER_COSPLAY_PITCH_RU,
    authorBlock,
    mid,
    workLink,
    coauthors,
    hashtags.join(" "),
  ]);
  return { title, description, hashtags };
}
