import { Router } from "express";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { pickPlacement, recordAdEvent } from "../lib/partnerHub";

const router = Router();

router.get("/", (req, res) => {
  const slot = String(req.query.slot || "").trim();
  if (!slot) return res.status(400).json({ error: "slot обязателен" });
  const city = String(req.query.city || "").trim();
  const placement = pickPlacement(slot, city || undefined);
  res.json({ placement });
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
