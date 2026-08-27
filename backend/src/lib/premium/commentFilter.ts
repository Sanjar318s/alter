/** Premium comment antispam — not AI quality scoring. */

const EMOJI_ONLY =
  /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\s\uFE0F\u200D]+$/u;

const BLOCKED_SHORT = new Set([
  "ok",
  "ок",
  "окей",
  "+",
  "++",
  "+++",
  "lol",
  "лол",
  "кек",
  "да",
  "нет",
  "ага",
  "угу",
  "nice",
  "cool",
  "👍",
  ".",
  "...",
  "??",
  "!",
]);

export function countsCommentForPremium(text: string): boolean {
  const raw = (text || "").trim();
  if (!raw) return false;
  if (EMOJI_ONLY.test(raw) && raw.replace(/\s/g, "").length <= 12) return false;

  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (BLOCKED_SHORT.has(normalized)) return false;
  if (/^[+\-*=.~!?,]+$/.test(normalized)) return false;

  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2) return false;
  // At least two tokens with a letter/digit each
  const meaningful = words.filter((w) => /[\p{L}\p{N}]/u.test(w));
  return meaningful.length >= 2;
}

export function isDuplicateSpamComment(
  text: string,
  recentSameUserTexts: string[]
): boolean {
  const n = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return true;
  const hits = recentSameUserTexts.filter(
    (t) => t.trim().toLowerCase().replace(/\s+/g, " ") === n
  ).length;
  return hits >= 2;
}
