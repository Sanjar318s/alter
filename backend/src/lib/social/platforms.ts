import { loadSocialSettings } from "./youtube";
import type { SocialPlatform } from "./queue";

const ALL_PUBLISH: SocialPlatform[] = ["youtube", "tiktok", "instagram", "facebook"];

function parseEnvPlatforms(): SocialPlatform[] | null {
  const raw = process.env.SOCIAL_PUBLISH_PLATFORMS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SocialPlatform => ALL_PUBLISH.includes(s as SocialPlatform));
  return list.length ? list : null;
}

/** Platforms enabled for auto-publish after moderation approval. Default: YouTube only. */
export function enabledPublishPlatforms(contentType: "publication" | "build"): SocialPlatform[] {
  const fromEnv = parseEnvPlatforms();
  if (fromEnv) {
    if (contentType === "publication") {
      return fromEnv.filter((p) => p === "youtube" || p === "tiktok");
    }
    return fromEnv.filter((p) => p === "instagram" || p === "facebook");
  }

  const settings = loadSocialSettings();
  if (contentType === "publication") {
    const out: SocialPlatform[] = [];
    if (settings.publishYoutube !== false) out.push("youtube");
    if (settings.publishTiktok) out.push("tiktok");
    return out.length ? out : ["youtube"];
  }

  const out: SocialPlatform[] = [];
  if (settings.publishInstagram) out.push("instagram");
  if (settings.publishFacebook) out.push("facebook");
  return out;
}

export function isYoutubePublishEnabled() {
  return enabledPublishPlatforms("publication").includes("youtube");
}
