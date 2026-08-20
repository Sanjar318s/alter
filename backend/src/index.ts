import "./lib/env";
import express from "express";
import cors from "cors";
import path from "path";
import { migrate } from "./db/migrate";
import { purgeDemoUsers } from "./db/purgeDemoUsers";
import { dbDriver } from "./db";
import { clearOwnerBlocks } from "./lib/ownerImmunity";
import { storageDriver, uploadsRouter, verifyR2Bucket } from "./lib/storage";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import buildRoutes from "./routes/builds";
import commissionRoutes from "./routes/commissions";
import orderRoutes from "./routes/orders";
import chatRoutes from "./routes/chat";
import notificationRoutes from "./routes/notifications";
import storyRoutes from "./routes/stories";
import publicationRoutes from "./routes/publications";
import commentRoutes from "./routes/comments";
import creditRoutes from "./routes/credits";
import exploreRoutes from "./routes/explore";
import uploadRoutes from "./routes/upload";
import accountRoutes from "./routes/account";
import financeRoutes from "./routes/finance";
import analyticsRoutes from "./routes/analytics";
import calendarRoutes from "./routes/calendar";
import adminRoutes from "./routes/admin";
import adminPartnersRoutes from "./routes/adminPartners";
import partnersRoutes from "./routes/partners";
import placementsRoutes from "./routes/placements";
import partnerPortalRoutes from "./routes/partnerPortal";
import fxRoutes from "./routes/fx";
import gifsRoutes from "./routes/gifs";
import integrationsRoutes from "./routes/integrations";
import { rateLimit } from "./middleware/rateLimit";
import { escalateOverdueReports } from "./lib/reportEscalation";
import { getModerationSettings } from "./lib/moderationSettings";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
        /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin) ||
        /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/i.test(origin)
      ) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    db: dbDriver,
    storage: storageDriver(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/uploads", (req, res, next) => {
  if (req.query.download) {
    const name = path.basename(req.path);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  }
  next();
});
app.use("/uploads", uploadsRouter, (_req, res) => {
  res.status(404).json({ error: "File not found" });
});

app.use("/api/auth", rateLimit(20, 60_000), authRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/users", userRoutes);
app.use("/api/builds", buildRoutes);
app.use("/api/commissions/orders", orderRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/messages", rateLimit(120, 60_000), chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/publications", publicationRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/fx", fxRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/partners", adminPartnersRoutes);
app.use("/api/partners", partnersRoutes);
app.use("/api/placements", placementsRoutes);
app.use("/api/partner-portal", partnerPortalRoutes);
app.use("/api/gifs", rateLimit(90, 60_000), gifsRoutes);
app.use("/api/integrations", integrationsRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[alter]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal error" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

migrate();
void verifyR2Bucket()
  .then(() => {
    if (storageDriver() === "r2") console.log("✓ R2 bucket reachable");
  })
  .catch((err) => {
    console.warn("⚠ R2 bucket check failed:", err instanceof Error ? err.message : err);
  });
try {
  const cleared = clearOwnerBlocks();
  if (cleared > 0) console.log(`✓ Cleared ${cleared} stale block(s) on owner account`);
} catch (err) {
  console.warn("⚠ Owner immunity cleanup skipped:", err instanceof Error ? err.message : err);
}
try {
  const { removedUsers, usernames } = purgeDemoUsers();
  if (removedUsers > 0) {
    console.log(`✓ Removed ${removedUsers} demo user(s): ${usernames.join(", ")}`);
  }
} catch (err) {
  console.warn("⚠ Demo purge skipped:", err instanceof Error ? err.message : err);
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`✓ ALTER API running on http://localhost:${PORT}`);
});

const fallbackEnabled = process.env.AUTO_ESCALATE_REPORTS !== "0";
const fallbackMs = Math.max(60_000, Number(process.env.AUTO_ESCALATE_INTERVAL_MS || 5 * 60 * 1000));
let lastAutoEscalationAt = 0;

setInterval(() => {
  try {
    const settings = getModerationSettings();
    const enabled = settings.autoEscalateEnabled ?? fallbackEnabled;
    const intervalMs = settings.autoEscalateIntervalMs || fallbackMs;
    if (!enabled) return;
    const now = Date.now();
    if (now - lastAutoEscalationAt < intervalMs) return;
    lastAutoEscalationAt = now;
    const result = escalateOverdueReports(null);
    if (result.escalated > 0) {
      console.log(`[moderation] auto-escalated overdue reports: ${result.escalated}`);
    }
  } catch (err) {
    console.warn("[moderation] auto-escalation failed:", err instanceof Error ? err.message : err);
  }
}, 60_000);
