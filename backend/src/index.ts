import "./lib/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { migrate } from "./db/migrate";
import { dbDriver } from "./db";
import { clearOwnerBlocks } from "./lib/ownerImmunity";
import { syncPlatformOwner } from "./lib/owner";
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
import adminSocialRoutes from "./routes/adminSocial";
import partnersRoutes from "./routes/partners";
import placementsRoutes from "./routes/placements";
import partnerPortalRoutes from "./routes/partnerPortal";
import fxRoutes from "./routes/fx";
import gifsRoutes from "./routes/gifs";
import integrationsRoutes from "./routes/integrations";
import { rateLimit } from "./middleware/rateLimit";
import { escalateOverdueReports } from "./lib/reportEscalation";
import { getModerationSettings } from "./lib/moderationSettings";
import { purgeInactivePlatformAccounts } from "./lib/inactivityPurge";

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

function corsAllowlist(): Set<string> {
  const set = new Set<string>();
  const site = (process.env.PUBLIC_SITE_URL || "https://altercosplay.vercel.app").replace(/\/$/, "");
  set.add(site);
  const extra = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  for (const o of extra) set.add(o);
  if (!isProd) {
    set.add("http://localhost:3000");
    set.add("http://127.0.0.1:3000");
    set.add("http://localhost:3001");
  }
  return set;
}

const ALLOWED_ORIGINS = corsAllowlist();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const clean = origin.replace(/\/$/, "");
      if (ALLOWED_ORIGINS.has(clean)) return cb(null, true);
      // Preview deploys of our Vercel project only (not arbitrary *.vercel.app)
      if (
        isProd &&
        /^https:\/\/alter-[a-z0-9-]+-sanjar7\.vercel\.app$/i.test(clean)
      ) {
        return cb(null, true);
      }
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean)) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "512kb" }));

app.get("/api/health", (_req, res) => {
  if (isProd) {
    return res.json({
      status: "ok",
      db: dbDriver,
      storage: storageDriver(),
      timestamp: new Date().toISOString(),
    });
  }
  const telegramSession = Boolean(process.env.TELEGRAM_SESSION || process.env.TELEGRAM_SESSION_STRING);
  const socialOAuthHints = {
    youtube: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
    meta: Boolean(process.env.META_APP_ID || process.env.FACEBOOK_APP_ID),
    tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
  };
  res.json({
    status: "ok",
    db: dbDriver,
    storage: storageDriver(),
    timestamp: new Date().toISOString(),
    paymentsLive: process.env.PAYMENTS_LIVE === "true" || process.env.PAYMENTS_LIVE === "1",
    workers: {
      web: "Fly process app — API",
      telegram: telegramSession
        ? "Fly process telegram — сессия задана; синк активен при живом процессе"
        : "Fly process telegram — без TELEGRAM_SESSION процесс падает при старте; деплой не ломает app",
      social:
        "Fly process social — очередь модерации/публикации; без OAuth токенов джобы откладываются",
    },
    socialOAuthConfigured: socialOAuthHints,
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
app.use("/api/explore", rateLimit(120, 60_000), exploreRoutes);
app.use("/api/upload", rateLimit(15, 60_000), uploadRoutes);
app.use("/api/account", rateLimit(60, 60_000), accountRoutes);
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
app.use("/api/fx", rateLimit(60, 60_000), fxRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/admin/social", adminSocialRoutes);
app.use("/api/admin/partners", adminPartnersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/partners", rateLimit(40, 60_000), partnersRoutes);
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
  const ownerUsername = syncPlatformOwner();
  if (ownerUsername) console.log(`✓ Platform owner synced (@${ownerUsername})`);
} catch (err) {
  console.warn("⚠ Owner sync skipped:", err instanceof Error ? err.message : err);
}
try {
  const cleared = clearOwnerBlocks();
  if (cleared > 0) console.log(`✓ Cleared ${cleared} stale block(s) on owner account`);
} catch (err) {
  console.warn("⚠ Owner immunity cleanup skipped:", err instanceof Error ? err.message : err);
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

const inactivityEnabled = process.env.INACTIVITY_PURGE !== "0";
const inactivityIntervalMs = Math.max(
  60 * 60 * 1000,
  Number(process.env.INACTIVITY_PURGE_INTERVAL_MS || 24 * 60 * 60 * 1000)
);
let lastInactivityPurgeAt = 0;

setInterval(() => {
  if (!inactivityEnabled) return;
  const now = Date.now();
  if (now - lastInactivityPurgeAt < inactivityIntervalMs) return;
  lastInactivityPurgeAt = now;
  try {
    const result = purgeInactivePlatformAccounts();
    if (result.deleted.length > 0) {
      console.log(
        `[inactivity] purged ${result.deleted.length} account(s)${result.dryRun ? " (dry-run)" : ""}: ${result.deleted.join(", ")}`
      );
    }
  } catch (err) {
    console.warn("[inactivity] purge failed:", err instanceof Error ? err.message : err);
  }
}, 60 * 60 * 1000);

setTimeout(() => {
  if (!inactivityEnabled) return;
  try {
    lastInactivityPurgeAt = Date.now();
    const result = purgeInactivePlatformAccounts();
    if (result.deleted.length > 0 || process.env.INACTIVITY_PURGE_LOG === "1") {
      console.log(
        `[inactivity] boot check: checked=${result.checked} deleted=${result.deleted.length} dryRun=${result.dryRun}`
      );
    }
  } catch (err) {
    console.warn("[inactivity] boot purge failed:", err instanceof Error ? err.message : err);
  }
}, 15_000);
