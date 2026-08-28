import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { ownerOnly } from "../middleware/roles";
import { notify } from "../lib/notify";
import { REJECT_NOTIFY_TEXT } from "../lib/social/constants";
import {
  enqueuePublishes,
  enqueueTiktokPublicRepost,
} from "../lib/social/queue";
import { createOAuthState, consumeOAuthState } from "../lib/social/oauthState";
import { enabledPublishPlatforms } from "../lib/social/platforms";
import { loadSocialSettings, saveSocialSettings } from "../lib/social/youtube";
import { syncSocialPosts } from "../lib/social/worker";

const router = Router();

function apiBase() {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    "https://alter-api-young-lantern-9418.fly.dev"
  ).replace(/\/$/, "");
}

function siteBase() {
  return (process.env.PUBLIC_SITE_URL || "https://altercosplay.vercel.app").replace(/\/$/, "");
}

function upsertOauthToken(provider: string, data: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  extraJson?: string | null;
}) {
  const existing = db
    .select()
    .from(schema.socialOauthTokens)
    .where(eq(schema.socialOauthTokens.provider, provider))
    .get();
  if (existing) {
    db.update(schema.socialOauthTokens)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? existing.refreshToken,
        expiresAt: data.expiresAt ?? existing.expiresAt,
        extraJson: data.extraJson ?? existing.extraJson,
        updatedAt: new Date(),
      })
      .where(eq(schema.socialOauthTokens.provider, provider))
      .run();
  } else {
    db.insert(schema.socialOauthTokens)
      .values({
        provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        expiresAt: data.expiresAt || null,
        extraJson: data.extraJson || null,
      })
      .run();
  }
}

// ─── Public OAuth callbacks (no JWT — provider redirects here) ───

router.get("/youtube/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code) return res.status(400).send("missing code");
  if (!consumeOAuthState(state, "youtube")) {
    return res.status(400).send("invalid or expired oauth state");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirect =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/youtube/callback`;
  if (!clientId || !clientSecret) return res.status(503).send("oauth not configured");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokenRes.ok || !data.access_token) {
      return res.status(400).send(data.error || "token exchange failed");
    }

    let channelId: string | undefined;
    try {
      const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const chData = (await ch.json()) as { items?: Array<{ id?: string }> };
      channelId = chData.items?.[0]?.id;
    } catch {
      /* optional */
    }

    upsertOauthToken("youtube", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      extraJson: JSON.stringify({ channelId }),
    });

    res.redirect(`${siteBase()}/admin?social=youtube_connected`);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : "oauth error");
  }
});

router.get("/meta/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code) return res.status(400).send("missing code");
  if (!consumeOAuthState(state, "meta")) {
    return res.status(400).send("invalid or expired oauth state");
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirect = process.env.META_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/meta/callback`;
  if (!appId || !appSecret) return res.status(503).send("oauth not configured");

  try {
    const shortRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirect,
        code,
      })}`
    );
    const short = (await shortRes.json()) as { access_token?: string; error?: { message?: string } };
    if (!short.access_token) return res.status(400).send(short.error?.message || "short token failed");

    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      })}`
    );
    const longTok = (await longRes.json()) as { access_token?: string; expires_in?: number };
    const userToken = longTok.access_token || short.access_token;

    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(userToken)}`
    );
    const accounts = (await accountsRes.json()) as {
      data?: Array<{ id: string; access_token: string }>;
    };
    const preferred = process.env.META_PAGE_ID;
    const page =
      (preferred && accounts.data?.find((p) => p.id === preferred)) || accounts.data?.[0];
    if (!page) return res.status(400).send("no facebook page");

    const pageInfoRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account,access_token&access_token=${encodeURIComponent(page.access_token)}`
    );
    const pageInfo = (await pageInfoRes.json()) as {
      instagram_business_account?: { id?: string };
      access_token?: string;
    };

    upsertOauthToken("meta", {
      accessToken: pageInfo.access_token || page.access_token,
      refreshToken: null,
      expiresAt: longTok.expires_in ? new Date(Date.now() + longTok.expires_in * 1000) : null,
      extraJson: JSON.stringify({
        pageId: page.id,
        igUserId: pageInfo.instagram_business_account?.id || process.env.META_IG_USER_ID || null,
      }),
    });

    res.redirect(`${siteBase()}/admin?social=meta_connected`);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : "oauth error");
  }
});

router.get("/tiktok/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code) return res.status(400).send("missing code");
  if (!consumeOAuthState(state, "tiktok")) {
    return res.status(400).send("invalid or expired oauth state");
  }

  const key = process.env.TIKTOK_CLIENT_KEY;
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  const redirect = process.env.TIKTOK_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/tiktok/callback`;
  if (!key || !secret) return res.status(503).send("oauth not configured");

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: key,
        client_secret: secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      }),
    });
    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      error?: string;
      error_description?: string;
    };
    if (!data.access_token) {
      return res.status(400).send(data.error_description || data.error || "token failed");
    }

    upsertOauthToken("tiktok", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      extraJson: JSON.stringify({ openId: data.open_id }),
    });

    res.redirect(`${siteBase()}/admin?social=tiktok_connected`);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : "oauth error");
  }
});

// ─── Owner-only admin routes ─────────────────────────────────

const ownerRouter = Router();
ownerRouter.use(authMiddleware, adminMiddleware, ownerOnly);

ownerRouter.get("/review", (_req, res) => {
  const rows = db
    .select()
    .from(schema.socialModeration)
    .where(eq(schema.socialModeration.status, "review"))
    .orderBy(desc(schema.socialModeration.createdAt))
    .limit(50)
    .all();

  const items = rows.map((m) => {
    let previewUrl: string | null = null;
    let caption: string | null = null;
    const author = db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get();
    if (m.contentType === "publication") {
      const pub = db.select().from(schema.publications).where(eq(schema.publications.id, m.contentId)).get();
      caption = pub?.caption || null;
      try {
        const media = JSON.parse(pub?.mediaJson || "[]") as string[];
        previewUrl = media[0] || null;
      } catch {
        previewUrl = null;
      }
    } else {
      const build = db.select().from(schema.builds).where(eq(schema.builds.id, m.contentId)).get();
      caption = build?.title || null;
      previewUrl = build?.coverImageUrl || null;
    }
    return {
      id: m.id,
      contentType: m.contentType,
      contentId: m.contentId,
      status: m.status,
      reason: m.reason,
      confidence: m.confidence,
      createdAt: m.createdAt,
      username: author?.username || null,
      previewUrl,
      caption,
    };
  });

  const rejected = db
    .select()
    .from(schema.socialModeration)
    .where(eq(schema.socialModeration.status, "rejected"))
    .orderBy(desc(schema.socialModeration.createdAt))
    .limit(50)
    .all()
    .map((m) => ({
      id: m.id,
      contentType: m.contentType,
      contentId: m.contentId,
      reason: m.reason,
      createdAt: m.createdAt,
    }));

  res.json({ items, rejected });
});

ownerRouter.post("/review/:id", (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const decision = String(req.body?.decision || "");
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "decision must be approved|rejected" });
  }
  const row = db.select().from(schema.socialModeration).where(eq(schema.socialModeration.id, id)).get();
  if (!row) return res.status(404).json({ error: "Not found" });

  db.update(schema.socialModeration)
    .set({
      status: decision,
      reason: note || row.reason,
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.socialModeration.id, id))
    .run();

  if (decision === "approved") {
    enqueuePublishes(row.contentType as "publication" | "build", row.contentId);
  } else {
    notify(row.userId, "social_moderation_rejected", {
      text: REJECT_NOTIFY_TEXT,
      contentType: row.contentType,
      contentId: row.contentId,
    });
  }

  res.json({ ok: true });
});

ownerRouter.get("/settings", (_req, res) => {
  const settings = loadSocialSettings();
  const tokens = db.select().from(schema.socialOauthTokens).all();
  res.json({
    settings,
    publishPlatforms: {
      publication: enabledPublishPlatforms("publication"),
      build: enabledPublishPlatforms("build"),
    },
    oauth: {
      youtube: Boolean(tokens.find((t) => t.provider === "youtube")?.refreshToken || tokens.find((t) => t.provider === "youtube")?.accessToken),
      meta: Boolean(tokens.find((t) => t.provider === "meta")?.accessToken),
      tiktok: Boolean(tokens.find((t) => t.provider === "tiktok")?.accessToken),
    },
  });
});

ownerRouter.post("/settings", (req, res) => {
  const body = req.body || {};
  const patch: Record<string, unknown> = {};
  if (typeof body.tiktokAuditApproved === "boolean") patch.tiktokAuditApproved = body.tiktokAuditApproved;
  if (typeof body.metaLiveMode === "boolean") patch.metaLiveMode = body.metaLiveMode;
  if (typeof body.youtubeDailyUploadCap === "number") patch.youtubeDailyUploadCap = body.youtubeDailyUploadCap;
  if (typeof body.publishYoutube === "boolean") patch.publishYoutube = body.publishYoutube;
  if (typeof body.publishTiktok === "boolean") patch.publishTiktok = body.publishTiktok;
  if (typeof body.publishInstagram === "boolean") patch.publishInstagram = body.publishInstagram;
  if (typeof body.publishFacebook === "boolean") patch.publishFacebook = body.publishFacebook;
  const settings = saveSocialSettings(patch);
  res.json({ settings });
});

ownerRouter.post("/sync-now", async (_req, res) => {
  const n = await syncSocialPosts(40);
  res.json({ ok: true, synced: n });
});

ownerRouter.post("/tiktok/republish-public", (_req, res) => {
  const rows = db
    .select()
    .from(schema.socialPosts)
    .where(
      and(
        eq(schema.socialPosts.platform, "tiktok"),
        inArray(schema.socialPosts.tiktokVisibility, ["private_pending_audit"])
      )
    )
    .all();
  for (const r of rows) enqueueTiktokPublicRepost(r.contentId);
  res.json({ ok: true, queued: rows.length });
});

ownerRouter.get("/posts", (_req, res) => {
  const posts = db
    .select()
    .from(schema.socialPosts)
    .orderBy(desc(schema.socialPosts.createdAt))
    .limit(40)
    .all()
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      status: p.status,
      contentType: p.contentType,
      contentId: p.contentId,
      externalUrl: p.externalUrl,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      viewsCount: p.viewsCount,
      tiktokVisibility: p.tiktokVisibility,
      error: p.error,
      createdAt: p.createdAt,
    }));
  res.json({ posts });
});

ownerRouter.get("/youtube/start", (req: AuthRequest, res) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirect =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/youtube/callback`;
  if (!clientId) return res.status(503).json({ error: "GOOGLE_OAUTH_CLIENT_ID missing" });
  const scope = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");
  const state = createOAuthState("youtube", req.userId!);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

ownerRouter.get("/meta/start", (req: AuthRequest, res) => {
  const appId = process.env.META_APP_ID;
  const redirect = process.env.META_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/meta/callback`;
  if (!appId) return res.status(503).json({ error: "META_APP_ID missing" });
  const state = createOAuthState("meta", req.userId!);
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set(
    "scope",
    "instagram_basic,instagram_content_publish,pages_show_list,pages_manage_posts,pages_read_engagement"
  );
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

ownerRouter.get("/tiktok/start", (req: AuthRequest, res) => {
  const key = process.env.TIKTOK_CLIENT_KEY;
  const redirect = process.env.TIKTOK_OAUTH_REDIRECT_URI || `${apiBase()}/api/admin/social/tiktok/callback`;
  if (!key) return res.status(503).json({ error: "TIKTOK_CLIENT_KEY missing" });
  const state = createOAuthState("tiktok", req.userId!);
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", key);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "video.upload,video.publish");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

router.use(ownerRouter);

export default router;
