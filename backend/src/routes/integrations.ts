import { Router } from "express";
import { publishEventsChannelMessage } from "../lib/channelMessage";

const router = Router();

function authorized(req: { headers: Record<string, unknown> }) {
  const secret = process.env.TELEGRAM_SYNC_SECRET?.trim();
  if (!secret) return false;
  return req.headers["x-telegram-sync-secret"] === secret;
}

router.post("/telegram/publish", (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const { text, mediaUrl, type, fileName, fileSize } = req.body as {
    text?: string;
    mediaUrl?: string;
    type?: string;
    fileName?: string;
    fileSize?: number;
  };

  try {
    const message = publishEventsChannelMessage({ text, mediaUrl, type, fileName, fileSize });
    res.status(201).json({ ok: true, message });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Publish failed" });
  }
});

export default router;
