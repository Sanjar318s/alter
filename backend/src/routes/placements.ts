import { Router } from "express";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { pickPlacement, recordAdEvent } from "../lib/partnerHub";
import { getCached, publicCacheHeaders, setCached } from "../lib/shortCache";

const router = Router();

router.get("/", (req, res) => {
  const slot = String(req.query.slot || "").trim();
  if (!slot) return res.status(400).json({ error: "slot обязателен" });
  const city = String(req.query.city || "").trim();
  const key = `placement:${slot}:${city}`;
  const hit = getCached<{ placement: unknown }>(key, 60_000);
  if (hit) {
    publicCacheHeaders(res, 60);
    return res.json(hit);
  }
  const placement = pickPlacement(slot, city || undefined);
  const payload = { placement };
  setCached(key, payload);
  publicCacheHeaders(res, 60);
  res.json(payload);
});

router.post(
  "/track",
  rateLimit(60, 60_000),
  optionalAuth,
  (req: AuthRequest, res) => {
    const { placementId, type, sessionId, city } = req.body as {
      placementId?: string;
      type?: "impression" | "click";
      sessionId?: string;
      city?: string;
    };
    if (!placementId || (type !== "impression" && type !== "click")) {
      return res.status(400).json({ error: "placementId и type обязательны" });
    }
    recordAdEvent({
      placementId,
      type,
      userId: req.userId,
      sessionId: sessionId || null,
      city: city || null,
    });
    res.json({ ok: true });
  }
);

export default router;
