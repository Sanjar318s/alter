import { Router } from "express";
import { db, schema } from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { JWT_SECRET, authMiddleware, AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";
import { deliverOtp, echoOtpEnabled, generateOtp, maskEmail, maskPhone, normalizePhone } from "../lib/otp";
import { flagsForUsername, normalizeUsername } from "../lib/owner";
import { blockedResponsePayload, getActiveBan } from "../lib/blocking";

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function asTime(v: Date | number | null | undefined) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return n < 1e12 ? n * 1000 : n;
}

function lookupUserByEmail(email: string) {
  return db.select().from(schema.users).where(eq(schema.users.email, email)).get();
}

function lookupUserByUsername(username: string) {
  return db.select().from(schema.users).where(eq(schema.users.username, username)).get();
}

function lookupUserByPhone(phone: string) {
  return db.select().from(schema.users).where(eq(schema.users.phone, phone)).get();
}

function issueToken(user: {
  id: string;
  email: string;
  username: string;
  roleFlags: string | null;
  phone?: string | null;
  platformRole?: string | null;
  socialCrosspostOptIn?: number | null;
}) {
  const jti = uuid();
  const token = jwt.sign({ userId: user.id, jti }, JWT_SECRET, { expiresIn: "7d" });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      roleFlags: user.roleFlags || "cosplayer",
      phone: user.phone || null,
      platformRole: user.platformRole || null,
      socialCrosspostOptIn: user.socialCrosspostOptIn !== 0,
    },
  };
}

function otpPayload(row: typeof schema.pendingSignups.$inferSelect, code?: string) {
  const target = row.channel === "phone" ? row.phone || "" : row.email || "";
  return {
    pendingId: row.id,
    channel: row.channel,
    maskedTarget: row.channel === "phone" ? maskPhone(target) : maskEmail(target),
    expiresIn: Math.max(0, Math.floor((asTime(row.expiresAt) - Date.now()) / 1000)),
    resendIn: Math.max(0, Math.ceil((RESEND_MS - (Date.now() - asTime(row.lastSentAt))) / 1000)),
    ...(echoOtpEnabled() && code ? { devCode: code } : {}),
  };
}

router.post("/register", async (req, res) => {
  try {
    const { email, phone, username, password, roleFlags, method } = req.body as {
      email?: string;
      phone?: string;
      username?: string;
      password?: string;
      roleFlags?: string;
      method?: "email" | "phone";
    };
    const channel: "email" | "phone" = method === "phone" ? "phone" : "email";
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: "Никнейм слишком короткий" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Пароль минимум 6 символов" });
    }

    const mail = (email || "").trim().toLowerCase();
    const tel = phone ? normalizePhone(phone) : "";
    if (channel === "email") {
      if (!mail || !mail.includes("@")) return res.status(400).json({ error: "Укажите email" });
    } else if (tel.replace(/\D/g, "").length < 10) {
      return res.status(400).json({ error: "Укажите номер телефона" });
    }

    const nick = normalizeUsername(username);
    if (lookupUserByUsername(nick)) {
      return res.status(409).json({ error: "Никнейм уже занят" });
    }
    if (channel === "email" && lookupUserByEmail(mail)) {
      return res.status(409).json({ error: "Email уже зарегистрирован" });
    }
    if (channel === "phone" && lookupUserByPhone(tel)) {
      return res.status(409).json({ error: "Телефон уже зарегистрирован" });
    }

    const code = generateOtp();
    const id = uuid();
    const now = new Date();
    db.insert(schema.pendingSignups)
      .values({
        id,
        username: nick,
        email: channel === "email" ? mail : null,
        phone: channel === "phone" ? tel : null,
        passwordHash: await bcrypt.hash(password, 10),
        roleFlags: flagsForUsername(roleFlags, nick),
        channel,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        lastSentAt: now,
      })
      .run();

    try {
      await deliverOtp(channel, channel === "phone" ? tel : mail, code);
    } catch (err: any) {
      db.delete(schema.pendingSignups).where(eq(schema.pendingSignups.id, id)).run();
      return res.status(503).json({ error: err?.message || "Не удалось отправить код" });
    }
    const row = db.select().from(schema.pendingSignups).where(eq(schema.pendingSignups.id, id)).get()!;
    res.status(201).json(otpPayload(row, code));
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { pendingId, code } = req.body as { pendingId?: string; code?: string };
    if (!pendingId || !code) return res.status(400).json({ error: "pendingId and code required" });

    const row = db.select().from(schema.pendingSignups).where(eq(schema.pendingSignups.id, pendingId)).get();
    if (!row) return res.status(404).json({ error: "Сессия подтверждения не найдена" });
    if (asTime(row.expiresAt) < Date.now()) {
      db.delete(schema.pendingSignups).where(eq(schema.pendingSignups.id, pendingId)).run();
      return res.status(410).json({ error: "Код истёк — зарегистрируйтесь снова" });
    }
    if ((row.attempts || 0) >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Слишком много попыток" });
    }

    const ok = await bcrypt.compare(String(code).trim(), row.codeHash);
    if (!ok) {
      db.update(schema.pendingSignups)
        .set({ attempts: (row.attempts || 0) + 1 })
        .where(eq(schema.pendingSignups.id, pendingId))
        .run();
      return res.status(401).json({ error: "Неверный код" });
    }

    if (lookupUserByUsername(row.username)) {
      return res.status(409).json({ error: "Никнейм уже занят" });
    }

    const userId = uuid();
    const email =
      row.email || `p${(row.phone || "").replace(/\D/g, "")}@phone.alter.local`;
    db.insert(schema.users)
      .values({
        id: userId,
        email,
        username: row.username,
        passwordHash: row.passwordHash,
        roleFlags: flagsForUsername(row.roleFlags || undefined, row.username),
        phone: row.phone || null,
      })
      .run();
    db.insert(schema.profiles)
      .values({
        userId,
        displayName: row.username,
        phone: row.phone || null,
      })
      .run();
    db.delete(schema.pendingSignups).where(eq(schema.pendingSignups.id, pendingId)).run();

    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    res.json(issueToken(user));
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

router.post("/resend", async (req, res) => {
  try {
    const { pendingId } = req.body as { pendingId?: string };
    if (!pendingId) return res.status(400).json({ error: "pendingId required" });
    const row = db.select().from(schema.pendingSignups).where(eq(schema.pendingSignups.id, pendingId)).get();
    if (!row) return res.status(404).json({ error: "Сессия не найдена" });
    const since = Date.now() - asTime(row.lastSentAt);
    if (since < RESEND_MS) {
      return res.status(429).json({
        error: `Подождите ${Math.ceil((RESEND_MS - since) / 1000)} с`,
        resendIn: Math.ceil((RESEND_MS - since) / 1000),
      });
    }
    const code = generateOtp();
    const now = new Date();
    const target = row.channel === "phone" ? row.phone || "" : row.email || "";
    try {
      await deliverOtp(row.channel as "email" | "phone", target, code);
    } catch (err: any) {
      return res.status(503).json({ error: err?.message || "Не удалось отправить код" });
    }
    db.update(schema.pendingSignups)
      .set({
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastSentAt: now,
        attempts: 0,
      })
      .where(eq(schema.pendingSignups.id, pendingId))
      .run();
    const updated = db.select().from(schema.pendingSignups).where(eq(schema.pendingSignups.id, pendingId)).get()!;
    res.json(otpPayload(updated, code));
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    if (!password) return res.status(400).json({ error: "password required" });

    const ident = String(email || phone || "").trim();
    let user = ident.includes("@") ? lookupUserByEmail(ident.toLowerCase()) : undefined;
    if (!user && ident) user = lookupUserByUsername(ident) || lookupUserByUsername(normalizeUsername(ident));
    if (!user && ident) {
      const tel = normalizePhone(phone || email || ident);
      if (tel.replace(/\D/g, "").length >= 10) user = lookupUserByPhone(tel);
    }
    if (!user) return res.status(401).json({ error: "Неверный email, телефон или пароль" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Неверный email, телефон или пароль" });
    const ban = getActiveBan(user.id);
    if (ban) return res.status(403).json(blockedResponsePayload(ban));

    res.json(issueToken(user));
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, req.userId!))
    .get();
  if (!user) return res.status(404).json({ error: "User not found" });

  const profile = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .get();

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      roleFlags: user.roleFlags,
      phone: user.phone,
      platformRole: user.platformRole || null,
      socialCrosspostOptIn: user.socialCrosspostOptIn !== 0,
    },
    profile,
  });
});

router.post("/logout", authMiddleware, (req: AuthRequest, res) => {
  if (req.tokenJti) {
    db.insert(schema.revokedTokens)
      .values({
        jti: req.tokenJti,
        userId: req.userId!,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      .run();
  }
  res.json({ ok: true });
});

router.post("/reset/request", async (req, res) => {
  try {
    const { email, phone } = req.body as { email?: string; phone?: string };
    const mail = (email || "").trim().toLowerCase();
    const tel = phone ? normalizePhone(phone) : "";
    const user = mail ? lookupUserByEmail(mail) : tel ? lookupUserByPhone(tel) : undefined;
    if (!user) {
      return res.json({ ok: true, message: "Если аккаунт существует, код отправлен" });
    }
    const channel: "email" | "phone" = tel && user.phone === tel ? "phone" : "email";
    const target = channel === "phone" ? user.phone || "" : user.email;
    const code = generateOtp();
    const id = uuid();
    db.insert(schema.passwordResets)
      .values({
        id,
        userId: user.id,
        channel,
        target,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
      })
      .run();
    try {
      await deliverOtp(channel, target, code);
    } catch (err: any) {
      db.delete(schema.passwordResets).where(eq(schema.passwordResets.id, id)).run();
      return res.status(503).json({ error: err?.message || "Не удалось отправить код" });
    }
    res.json({
      ok: true,
      resetId: id,
      channel,
      maskedTarget: channel === "phone" ? maskPhone(target) : maskEmail(target),
      ...(echoOtpEnabled() ? { devCode: code } : {}),
    });
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

router.post("/reset/confirm", async (req, res) => {
  try {
    const { resetId, code, newPassword } = req.body as { resetId?: string; code?: string; newPassword?: string };
    if (!resetId || !code || !newPassword) return res.status(400).json({ error: "Все поля обязательны" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
    const row = db.select().from(schema.passwordResets).where(eq(schema.passwordResets.id, resetId)).get();
    if (!row) return res.status(404).json({ error: "Сессия не найдена" });
    if (asTime(row.expiresAt) < Date.now()) return res.status(410).json({ error: "Код истёк" });
    if ((row.attempts || 0) >= MAX_ATTEMPTS) return res.status(429).json({ error: "Слишком много попыток" });
    const ok = await bcrypt.compare(String(code).trim(), row.codeHash);
    if (!ok) {
      db.update(schema.passwordResets)
        .set({ attempts: (row.attempts || 0) + 1 })
        .where(eq(schema.passwordResets.id, resetId))
        .run();
      return res.status(401).json({ error: "Неверный код" });
    }
    db.update(schema.users)
      .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
      .where(eq(schema.users.id, row.userId))
      .run();
    db.delete(schema.passwordResets).where(eq(schema.passwordResets.id, resetId)).run();
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[auth]", err); res.status(500).json({ error: "Internal error" });
  }
});

export default router;
