import fs from "fs";
import path from "path";
import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import type { EntityLike } from "telegram/define";
import { eq } from "drizzle-orm";
import { COSPLAYERS_SOURCE_KEY } from "./client";
import { db, schema } from "../db";
import { putUpload } from "../lib/storage";
import { publishEventsChannelMessage } from "../lib/channelMessage";

const STATE_FILE = path.join(__dirname, "..", "..", "data", "telegram-sync-state.json");

const PROCESSED_IDS_LIMIT = 20000;

type SourceCursor = {
  chatId?: string;
  topicId?: number;
  lastMessageId?: number;
};

type SyncState = {
  chatId?: string;
  topicId?: number;
  lastMessageId?: number;
  processedIds?: string[];
  sources?: Record<string, SourceCursor>;
};

export type TelegramHandleOpts = {
  sourceKey: string;
  topicId?: number;
  requireKeywords?: string[];
  ignoreBaseline?: boolean;
};

function sourceCursor(state: SyncState, key: string): SourceCursor {
  if (state.sources?.[key]) return state.sources[key];
  if (key === COSPLAYERS_SOURCE_KEY) {
    return { chatId: state.chatId, topicId: state.topicId, lastMessageId: state.lastMessageId };
  }
  return {};
}

function withSourceCursor(state: SyncState, key: string, cursor: SourceCursor): SyncState {
  const next: SyncState = {
    ...state,
    sources: { ...(state.sources || {}), [key]: cursor },
  };
  if (key === COSPLAYERS_SOURCE_KEY) {
    next.chatId = cursor.chatId;
    next.topicId = cursor.topicId;
    next.lastMessageId = cursor.lastMessageId;
  }
  return next;
}

function matchesKeywords(text: string, keywords: string[]) {
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  return keywords.some((k) => hay.includes(k.toLowerCase().replace(/\s+/g, " ")));
}

const STATE_KV_KEY = "telegram-sync-state";

function parseState(raw: string): SyncState | null {
  try {
    return JSON.parse(raw) as SyncState;
  } catch {
    return null;
  }
}

function readState(): SyncState {
  try {
    const row = db.select().from(schema.appKv).where(eq(schema.appKv.key, STATE_KV_KEY)).get();
    if (row?.value) {
      const parsed = parseState(row.value);
      if (parsed) return parsed;
    }
  } catch {
    /* table may not exist yet */
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = parseState(fs.readFileSync(STATE_FILE, "utf8"));
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeState(state: SyncState) {
  const processedIds = (state.processedIds || []).slice(-PROCESSED_IDS_LIMIT);
  const next = { ...state, processedIds };
  const json = JSON.stringify(next, null, 2);
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, json, "utf8");
  } catch {
    /* Fly root fs may be read-only besides /tmp */
  }
  try {
    const existing = db.select().from(schema.appKv).where(eq(schema.appKv.key, STATE_KV_KEY)).get();
    if (existing) {
      db.update(schema.appKv)
        .set({ value: json, updatedAt: new Date() })
        .where(eq(schema.appKv.key, STATE_KV_KEY))
        .run();
    } else {
      db.insert(schema.appKv).values({ key: STATE_KV_KEY, value: json, updatedAt: new Date() }).run();
    }
  } catch (err) {
    console.warn("[telegram] failed to persist state to DB:", err instanceof Error ? err.message : err);
  }
}

function dedupeKey(message: Api.Message) {
  return `${message.chatId}:${message.id}`;
}

function messageTopicId(message: Api.Message) {
  const reply = message.replyTo;
  if (!reply || typeof reply !== "object") return null;
  const top = (reply as { replyToTopId?: number; replyToMsgId?: number }).replyToTopId;
  if (top) return top;
  const msgId = (reply as { replyToMsgId?: number }).replyToMsgId;
  return msgId ?? null;
}

function belongsToTopic(message: Api.Message, topicId: number) {
  const top = messageTopicId(message);
  if (top === topicId) return true;
  // Some forum messages use top message id on the thread root itself.
  if (message.id === topicId) return true;
  return false;
}

function mimeFromFileName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

async function uploadTelegramMedia(client: TelegramClient, message: Api.Message) {
  const buffer = (await client.downloadMedia(message, {})) as Buffer | undefined;
  if (!buffer?.length) return null;

  let ext = "jpg";
  const doc = message.media && "document" in message.media ? message.media.document : null;
  if (doc && "mimeType" in doc && typeof doc.mimeType === "string") {
    const mime = doc.mimeType;
    if (mime.includes("png")) ext = "png";
    else if (mime.includes("webp")) ext = "webp";
    else if (mime.includes("gif")) ext = "gif";
    else if (mime.includes("mp4")) ext = "mp4";
  }

  const mime = mimeFromFileName(`file.${ext}`);
  const filename = `${message.id}.${ext}`;
  const stored = await putUpload(filename, buffer, mime);
  return {
    url: stored.url,
    mime,
    size: buffer.length,
    type: mime.startsWith("video/") ? "video" : "image",
  };
}

function buildText(message: Api.Message) {
  const raw = (message.message || "").trim();
  const prefix = process.env.TELEGRAM_PUBLISH_PREFIX?.trim();
  if (!prefix) return raw || null;
  if (!raw) return prefix;
  return `${prefix}\n\n${raw}`;
}

function markSeen(state: SyncState, sourceKey: string, message: Api.Message, topicId?: number, processed = false) {
  const cursor = sourceCursor(state, sourceKey);
  const nextCursor: SourceCursor = {
    ...cursor,
    chatId: String(message.chatId ?? cursor.chatId ?? ""),
    topicId: topicId ?? cursor.topicId,
    lastMessageId: Math.max(cursor.lastMessageId || 0, message.id),
  };
  const processedIds = processed ? [...(state.processedIds || []), dedupeKey(message)] : state.processedIds || [];
  writeState(withSourceCursor({ ...state, processedIds }, sourceKey, nextCursor));
}

export async function handleTelegramMessage(
  client: TelegramClient,
  message: Api.Message,
  opts: TelegramHandleOpts
): Promise<"published" | "skipped" | "duplicate"> {
  if (!message?.id) return "skipped";
  if (message.out) return "skipped";
  if (opts.topicId != null && !belongsToTopic(message, opts.topicId)) return "skipped";

  const state = readState();
  const cursor = sourceCursor(state, opts.sourceKey);
  if (!opts.ignoreBaseline && cursor.lastMessageId && message.id <= cursor.lastMessageId) return "skipped";

  const key = dedupeKey(message);
  if (state.processedIds?.includes(key)) return "duplicate";

  const raw = (message.message || "").trim();
  if (opts.requireKeywords?.length && !matchesKeywords(raw, opts.requireKeywords)) {
    markSeen(state, opts.sourceKey, message, opts.topicId);
    return "skipped";
  }

  const text = buildText(message);
  const hasPhoto =
    Boolean(message.photo) ||
    (message.media && "document" in message.media && String((message.media.document as Api.Document)?.mimeType || "").startsWith("image/"));
  const hasVideo =
    message.media && "document" in message.media && String((message.media.document as Api.Document)?.mimeType || "").startsWith("video/");

  if (!text && !hasPhoto && !hasVideo) {
    markSeen(state, opts.sourceKey, message, opts.topicId);
    return "skipped";
  }

  if (hasPhoto || hasVideo) {
    const uploaded = await uploadTelegramMedia(client, message);
    if (uploaded) {
      publishEventsChannelMessage({
        text,
        mediaUrl: uploaded.url,
        type: uploaded.type,
        fileName: `telegram-${message.id}`,
        fileSize: uploaded.size,
      });
      console.log(`[telegram] published media message ${message.id} → ${uploaded.url}`);
    } else if (text) {
      publishEventsChannelMessage({ text });
      console.log(`[telegram] published text-only message ${message.id}`);
    } else {
      markSeen(state, opts.sourceKey, message, opts.topicId);
      return "skipped";
    }
  } else if (text) {
    publishEventsChannelMessage({ text });
    console.log(`[telegram] published text message ${message.id}`);
  }

  markSeen(state, opts.sourceKey, message, opts.topicId, true);
  return "published";
}

export async function seedTopicBaseline(client: TelegramClient, entity: EntityLike, topicId: number) {
  const state = readState();
  const cursor = sourceCursor(state, COSPLAYERS_SOURCE_KEY);
  if (cursor.lastMessageId) return;

  const history = await client.getMessages(entity, { limit: 1, replyTo: topicId });
  const latest = history[0];
  const lastMessageId = latest?.id || topicId;
  writeState(
    withSourceCursor(
      { ...state, processedIds: state.processedIds || [] },
      COSPLAYERS_SOURCE_KEY,
      { chatId: String(latest?.chatId ?? ""), topicId, lastMessageId }
    )
  );
  console.log(`[telegram] @${COSPLAYERS_SOURCE_KEY} baseline — only messages after id ${lastMessageId} will sync`);
}

export async function seedChannelBaseline(client: TelegramClient, entity: EntityLike, sourceKey: string) {
  const state = readState();
  const cursor = sourceCursor(state, sourceKey);
  if (cursor.lastMessageId) return;

  const history = await client.getMessages(entity, { limit: 1 });
  const latest = history[0];
  const lastMessageId = latest?.id || 0;
  writeState(
    withSourceCursor(
      { ...state, processedIds: state.processedIds || [] },
      sourceKey,
      { chatId: String(latest?.chatId ?? ""), lastMessageId }
    )
  );
  console.log(`[telegram] @${sourceKey} baseline — only messages after id ${lastMessageId} will sync`);
}

export async function backfillTopicHistory(client: TelegramClient, entity: EntityLike, topicId: number) {
  let scanned = 0;
  let published = 0;
  let duplicates = 0;
  let skipped = 0;

  console.log(`[telegram:backfill] @${entity} topic ${topicId} — oldest → newest`);

  for await (const message of client.iterMessages(entity, { replyTo: topicId, reverse: true, waitTime: 1 })) {
    if (!(message instanceof Api.Message)) continue;
    scanned++;
    const result = await handleTelegramMessage(client, message, {
      sourceKey: COSPLAYERS_SOURCE_KEY,
      topicId,
      ignoreBaseline: true,
    });
    if (result === "published") published++;
    else if (result === "duplicate") duplicates++;
    else skipped++;

    if (scanned % 25 === 0) {
      console.log(`[telegram:backfill] progress: scanned ${scanned}, published ${published}, skipped ${skipped}, dup ${duplicates}`);
    }
  }

  const history = await client.getMessages(entity, { limit: 1, replyTo: topicId });
  const latest = history[0];
  const state = readState();
  writeState(
    withSourceCursor(
      { ...state, processedIds: state.processedIds || [] },
      COSPLAYERS_SOURCE_KEY,
      {
        ...sourceCursor(state, COSPLAYERS_SOURCE_KEY),
        chatId: String(latest?.chatId ?? sourceCursor(state, COSPLAYERS_SOURCE_KEY).chatId ?? ""),
        topicId,
        lastMessageId: latest?.id || topicId,
      }
    )
  );

  console.log(
    `[telegram:backfill] done — scanned ${scanned}, published ${published}, skipped ${skipped}, duplicates ${duplicates}, lastMessageId ${latest?.id || topicId}`
  );
}

export type PollStats = {
  sourceKey: string;
  scanned: number;
  published: number;
  skipped: number;
  duplicates: number;
  lastMessageId: number;
  baseline: boolean;
};

async function fetchMessagesSince(
  client: TelegramClient,
  entity: EntityLike,
  minId: number,
  topicId?: number
) {
  const collected: Api.Message[] = [];
  let offsetId = 0;
  for (;;) {
    const batch = await client.getMessages(entity, {
      limit: 100,
      minId,
      offsetId,
      waitTime: 1,
      ...(topicId != null ? { replyTo: topicId } : {}),
    });
    const messages = batch.filter((m): m is Api.Message => m instanceof Api.Message && Boolean(m.id));
    if (!messages.length) break;
    collected.push(...messages);
    const oldest = messages.reduce((a, b) => (a.id < b.id ? a : b));
    if (messages.length < 100 || oldest.id <= minId + 1) break;
    offsetId = oldest.id;
    if (collected.length >= 500) break;
  }
  collected.sort((a, b) => a.id - b.id);
  return collected;
}

export async function pollSource(
  client: TelegramClient,
  entity: EntityLike,
  opts: { sourceKey: string; topicId?: number; requireKeywords?: string[] }
): Promise<PollStats> {
  const state = readState();
  let cursor = sourceCursor(state, opts.sourceKey);
  if (!cursor.lastMessageId) {
    if (opts.topicId != null) await seedTopicBaseline(client, entity, opts.topicId);
    else await seedChannelBaseline(client, entity, opts.sourceKey);
    const after = sourceCursor(readState(), opts.sourceKey);
    console.log(`[telegram:poll] @${opts.sourceKey} first run — baseline ${after.lastMessageId}, skip historical`);
    return {
      sourceKey: opts.sourceKey,
      scanned: 0,
      published: 0,
      skipped: 0,
      duplicates: 0,
      lastMessageId: after.lastMessageId || 0,
      baseline: true,
    };
  }

  const minId = cursor.lastMessageId;
  const messages = await fetchMessagesSince(client, entity, minId, opts.topicId);
  let published = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const message of messages) {
    const result = await handleTelegramMessage(client, message, {
      sourceKey: opts.sourceKey,
      topicId: opts.topicId,
      requireKeywords: opts.requireKeywords,
    });
    if (result === "published") published++;
    else if (result === "duplicate") duplicates++;
    else skipped++;
  }

  const latestInBatch = messages.length ? messages[messages.length - 1] : null;
  const head = await client.getMessages(entity, {
    limit: 1,
    waitTime: 1,
    ...(opts.topicId != null ? { replyTo: opts.topicId } : {}),
  });
  const latest = head[0];
  const lastMessageId = Math.max(
    sourceCursor(readState(), opts.sourceKey).lastMessageId || 0,
    latestInBatch?.id || 0,
    latest?.id || 0,
    minId
  );

  const fresh = readState();
  writeState(
    withSourceCursor(fresh, opts.sourceKey, {
      ...sourceCursor(fresh, opts.sourceKey),
      chatId: String(latest?.chatId ?? latestInBatch?.chatId ?? cursor.chatId ?? ""),
      topicId: opts.topicId ?? cursor.topicId,
      lastMessageId,
    })
  );

  console.log(
    `[telegram:poll] @${opts.sourceKey} scanned=${messages.length} published=${published} skipped=${skipped} dup=${duplicates} lastId=${lastMessageId}`
  );
  return {
    sourceKey: opts.sourceKey,
    scanned: messages.length,
    published,
    skipped,
    duplicates,
    lastMessageId,
    baseline: false,
  };
}

export { readState, writeState, belongsToTopic, messageTopicId, dedupeKey };
