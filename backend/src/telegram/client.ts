import fs from "fs";
import path from "path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const SESSION_FILE = path.join(__dirname, "..", "..", "data", "telegram.session");

export function loadSessionString() {
  if (process.env.TELEGRAM_SESSION?.trim()) return process.env.TELEGRAM_SESSION.trim();
  if (fs.existsSync(SESSION_FILE)) return fs.readFileSync(SESSION_FILE, "utf8").trim();
  return "";
}

export function saveSessionString(session: string) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, session, "utf8");
}

export function telegramConfig() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH?.trim();
  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH are required in backend/.env");
  }
  return { apiId, apiHash };
}

export function createTelegramClient(sessionString?: string) {
  const { apiId, apiHash } = telegramConfig();
  const session = new StringSession(sessionString ?? loadSessionString());
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
}

export function sourceChatUsername() {
  return (process.env.TELEGRAM_SOURCE_CHAT || "cosplayers_uzb").replace(/^@/, "");
}

export function sourceTopicId() {
  const raw = process.env.TELEGRAM_TOPIC_ID || "60704";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 60704;
}
