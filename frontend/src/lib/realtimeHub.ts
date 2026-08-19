type Handler = (event: string, data: unknown) => void;

let es: EventSource | null = null;
let token: string | null = null;
const handlers = new Set<Handler>();

const EVENTS = ["message", "typing", "stats", "notification", "message_edit", "message_delete", "ping"] as const;

function attachListeners(source: EventSource) {
  for (const name of EVENTS) {
    source.addEventListener(name, (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        handlers.forEach((h) => h(name, data));
      } catch {
        /* ignore malformed payloads */
      }
    });
  }
}

export function subscribeRealtime(handler: Handler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function connectRealtime(nextToken: string) {
  token = nextToken;
  if (es) return;
  const api = process.env.NEXT_PUBLIC_API_URL || "";
  es = new EventSource(`${api}/api/messages/stream?token=${encodeURIComponent(nextToken)}`);
  attachListeners(es);
}

export function disconnectRealtime() {
  es?.close();
  es = null;
  token = null;
}

export function isRealtimeConnected() {
  return Boolean(es);
}

export function getRealtimeToken() {
  return token;
}
