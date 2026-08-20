import fs from "fs";
import path from "path";
import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import type { EntityLike } from "telegram/define";
import { putUpload } from "../lib/storage";
import { publishEventsChannelMessage } from "../lib/channelMessage";

const STATE_FILE = path.join(__dirname, "..", "..", "data", "telegram-sync-state.json");

const PROCESSED_IDS_LIMIT = 20000;

type SyncState = {
  chatId?: string;
  topicId?: number;
  lastMessageId?: number;
  processedIds?: string[];
};

function readState(): SyncState {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as SyncState;
  } catch {
    /* ignore */
  }
  return {};
}

function writeState(state: SyncState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const processedIds = (state.processedIds || []).slice(-PROCESSED_IDS_LIMIT);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, processedIds }, null, 2), "utf8");
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

export async function handleTelegramMessage(
  client: TelegramClient,
  message: Api.Message,
  topicId: number
): Promise<"published" | "skipped" | "duplicate"> {
  if (!message?.id) return "skipped";
  if (message.out) return "skipped";
  if (!belongsToTopic(message, topicId)) return "skipped";

  const state = readState();
  const key = dedupeKey(message);
  if (state.processedIds?.includes(key)) return "duplicate";

  const text = buildText(message);
  const hasPhoto =
    Boolean(message.photo) ||
    (message.media && "document" in message.media && String((message.media.document as Api.Document)?.mimeType || "").startsWith("image/"));
  const hasVideo =
    message.media && "document" in message.media && String((message.media.document as Api.Document)?.mimeType || "").startsWith("video/");

  if (!text && !hasPhoto && !hasVideo) return "skipped";

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
      return "skipped";
    }
  } else if (text) {
    publishEventsChannelMessage({ text });
    console.log(`[telegram] published text message ${message.id}`);
  }

  const processedIds = [...(state.processedIds || []), key];
  writeState({
    ...state,
    chatId: String(message.chatId ?? state.chatId ?? ""),
    topicId,
    lastMessageId: Math.max(state.lastMessageId || 0, message.id),
    processedIds,
  });
  return "published";
}

export async function seedTopicBaseline(client: TelegramClient, entity: EntityLike, topicId: number) {
  const state = readState();
  if (state.lastMessageId) return;

  const history = await client.getMessages(entity, { limit: 1, replyTo: topicId });
  const latest = history[0];
  writeState({
    ...state,
    chatId: String(latest?.chatId ?? ""),
    topicId,
    lastMessageId: latest?.id || topicId,
    processedIds: state.processedIds || [],
  });
  console.log(`[telegram] baseline set — only messages after id ${latest?.id || topicId} will sync`);
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
    const result = await handleTelegramMessage(client, message, topicId);
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
  writeState({
    ...state,
    chatId: String(latest?.chatId ?? state.chatId ?? ""),
    topicId,
    lastMessageId: latest?.id || topicId,
    processedIds: state.processedIds || [],
  });

  console.log(
    `[telegram:backfill] done — scanned ${scanned}, published ${published}, skipped ${skipped}, duplicates ${duplicates}, lastMessageId ${latest?.id || topicId}`
  );
}

export { readState, writeState, belongsToTopic, messageTopicId, dedupeKey };
