const FAV = "alter:message-favorites";
const HIDDEN = "alter:message-hidden-users";
const THREAD_SUB = "alter:message-thread-subs";
const PINNED = "alter:message-pinned";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function isMessageFavorite(id: string) {
  return readJson<string[]>(FAV, []).includes(id);
}

export function toggleMessageFavorite(id: string) {
  const list = readJson<string[]>(FAV, []);
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  writeJson(FAV, next);
  return next.includes(id);
}

export function getHiddenSenders() {
  return readJson<string[]>(HIDDEN, []);
}

export function hideSender(username: string) {
  const key = username.toLowerCase();
  const list = readJson<string[]>(HIDDEN, []);
  if (!list.includes(key)) writeJson(HIDDEN, [...list, key]);
}

export function unhideSender(username: string) {
  const key = username.toLowerCase();
  writeJson(HIDDEN, getHiddenSenders().filter((x) => x !== key));
}

export function isThreadSubscribed(messageId: string) {
  return readJson<string[]>(THREAD_SUB, []).includes(messageId);
}

export function toggleThreadSubscription(messageId: string) {
  const list = readJson<string[]>(THREAD_SUB, []);
  const next = list.includes(messageId) ? list.filter((x) => x !== messageId) : [...list, messageId];
  writeJson(THREAD_SUB, next);
  return next.includes(messageId);
}

export function getPinnedMessageIds(conversationId: string) {
  const map = readJson<Record<string, string[]>>(PINNED, {});
  return map[conversationId] || [];
}

export function isMessagePinned(conversationId: string, messageId: string) {
  return getPinnedMessageIds(conversationId).includes(messageId);
}

export function togglePinnedMessage(conversationId: string, messageId: string) {
  const map = readJson<Record<string, string[]>>(PINNED, {});
  const list = map[conversationId] || [];
  const next = list.includes(messageId) ? list.filter((x) => x !== messageId) : [...list, messageId];
  writeJson(PINNED, { ...map, [conversationId]: next });
  return next.includes(messageId);
}
