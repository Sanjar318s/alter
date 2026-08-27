import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import {
  GEMINI_MAX_PER_DAY,
  GEMINI_MIN_INTERVAL_MS,
  GEMINI_MODEL,
  geminiQuotaKey,
} from "./constants";
import { fetchImageInlineBase64 } from "./media";

export type GeminiVerdict = "yes" | "no" | "unsure";
export type GeminiConfidence = "high" | "medium" | "low";

export type GeminiResult = {
  verdict: GeminiVerdict;
  confidence: GeminiConfidence;
  reason: string;
  model: string;
  rawJson: string;
  deferred?: boolean;
  deferReason?: string;
};

let lastGeminiCallAt = 0;

function getKv(key: string): string | null {
  return db.select().from(schema.appKv).where(eq(schema.appKv.key, key)).get()?.value ?? null;
}

function setKv(key: string, value: string) {
  const existing = db.select().from(schema.appKv).where(eq(schema.appKv.key, key)).get();
  if (existing) {
    db.update(schema.appKv).set({ value, updatedAt: new Date() }).where(eq(schema.appKv.key, key)).run();
  } else {
    db.insert(schema.appKv).values({ key, value, updatedAt: new Date() }).run();
  }
}

export function getGeminiDayCount(): number {
  return Number(getKv(geminiQuotaKey()) || 0);
}

export function incrementGeminiDayCount(): number {
  const key = geminiQuotaKey();
  const next = getGeminiDayCount() + 1;
  setKv(key, String(next));
  return next;
}

function parseVerdict(text: string): { verdict: GeminiVerdict; confidence: GeminiConfidence; reason: string } {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const obj = JSON.parse(jsonStr) as {
      verdict?: string;
      confidence?: string;
      reason?: string;
    };
    const verdict =
      obj.verdict === "yes" || obj.verdict === "no" || obj.verdict === "unsure" ? obj.verdict : "unsure";
    const confidence =
      obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
        ? obj.confidence
        : "low";
    return { verdict, confidence, reason: String(obj.reason || "").slice(0, 500) };
  } catch {
    return { verdict: "unsure", confidence: "low", reason: "parse_failed" };
  }
}

const SYSTEM_PROMPT = `Ты классификатор контента для бренда AlterCosPlay.
Разрешённая тема: косплей, костюмы, парики, грим, реквизит, процесс пошива/брони, персонажи, конвенты косплея.
Запрещено для автопостинга бренда: NSFW, оружие IRL как угроза, политика, чистый UGC не про косплей (еда, кот без костюма, случайные селфи), спам, водяные знаки чужих магазинов как основной смысл.
Верни ТОЛЬКО JSON без markdown:
{"verdict":"yes"|"no"|"unsure","confidence":"high"|"medium"|"low","reason":"..."}`;

export async function moderateWithGemini(input: {
  contentType: "publication" | "build";
  contentId: string;
  text: string;
  imageUrl?: string | null;
  isVideo?: boolean;
}): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = GEMINI_MODEL;

  if (!apiKey) {
    return {
      verdict: "unsure",
      confidence: "low",
      reason: "gemini_key_missing",
      model,
      rawJson: "{}",
      deferred: true,
      deferReason: "gemini_key_missing",
    };
  }

  const dayCount = getGeminiDayCount();
  if (dayCount >= GEMINI_MAX_PER_DAY) {
    return {
      verdict: "unsure",
      confidence: "low",
      reason: "gemini_quota",
      model,
      rawJson: "{}",
      deferred: true,
      deferReason: "gemini_quota",
    };
  }

  const wait = GEMINI_MIN_INTERVAL_MS - (Date.now() - lastGeminiCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const parts: Array<Record<string, unknown>> = [
    { text: SYSTEM_PROMPT },
    {
      text: [
        `contentType=${input.contentType}`,
        `contentId=${input.contentId}`,
        input.isVideo ? "media is video (image below is cover if present)" : "media is image or none",
        input.text.slice(0, 4000),
      ].join("\n"),
    },
  ];

  if (input.imageUrl) {
    const inline = await fetchImageInlineBase64(input.imageUrl);
    if (inline) {
      parts.push({ inline_data: { mime_type: inline.mime, data: inline.data } });
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  lastGeminiCallAt = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });
  } catch (err) {
    return {
      verdict: "unsure",
      confidence: "low",
      reason: `network:${err instanceof Error ? err.message : "error"}`,
      model,
      rawJson: "{}",
      deferred: true,
      deferReason: "gemini_network",
    };
  }

  if (res.status === 429) {
    return {
      verdict: "unsure",
      confidence: "low",
      reason: "gemini_429",
      model,
      rawJson: "{}",
      deferred: true,
      deferReason: "gemini_429",
    };
  }

  const rawText = await res.text();
  const rawJson = rawText.slice(0, 8000);
  incrementGeminiDayCount();

  if (!res.ok) {
    console.log("[social] gemini", {
      contentType: input.contentType,
      contentId: input.contentId,
      verdict: "unsure",
      dayCount: getGeminiDayCount(),
      status: res.status,
    });
    return {
      verdict: "unsure",
      confidence: "low",
      reason: `http_${res.status}`,
      model,
      rawJson,
    };
  }

  let modelText = "";
  try {
    const parsed = JSON.parse(rawText) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    if (parsed.promptFeedback?.blockReason) {
      return {
        verdict: "unsure",
        confidence: "low",
        reason: `safety:${parsed.promptFeedback.blockReason}`,
        model,
        rawJson,
      };
    }
    modelText = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  } catch {
    modelText = rawText;
  }

  const { verdict, confidence, reason } = parseVerdict(modelText);
  console.log("[social] gemini", {
    contentType: input.contentType,
    contentId: input.contentId,
    verdict,
    dayCount: getGeminiDayCount(),
  });

  return { verdict, confidence, reason, model, rawJson };
}

export function mapGeminiToModerationStatus(
  result: GeminiResult
): "approved" | "rejected" | "review" {
  if (result.verdict === "yes" && result.confidence !== "low") return "approved";
  if (result.verdict === "no" && result.confidence === "high") return "rejected";
  return "review";
}
