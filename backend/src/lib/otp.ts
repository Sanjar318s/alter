import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const keep = Math.min(2, name.length);
  return `${name.slice(0, keep)}•••@${domain}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `+${digits.slice(0, 3)} ••• ${digits.slice(-4)}`;
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Playwright / local dev. Never on a public server. */
export function echoOtpEnabled() {
  if (process.env.OTP_ECHO === "1") return true;
  if (process.env.OTP_ECHO === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function devOutboxEnabled() {
  if (process.env.OTP_DEV_OUTBOX === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function writeOutbox(kind: "email" | "phone", to: string, code: string) {
  const dir = path.join(__dirname, "..", "..", "data", "outbox");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${kind}-${stamp}.txt`);
  const body =
    kind === "email"
      ? `To: ${to}\nSubject: ${MAIL_SUBJECT}\n\n${MAIL_TEXT(code)}`
      : `To: ${to}\n\n${SMS_TEXT(code)}`;
  fs.writeFileSync(file, body, "utf8");
  const masked = kind === "email" ? maskEmail(to) : maskPhone(to);
  console.log(`[OTP] ${kind} → ${masked} via outbox (${file})`);
}

const SMS_TEXT = (code: string) => `ALTER: kod podtverzhdeniya ${code}. Deistvuet 10 min.`;
const MAIL_SUBJECT = "Код подтверждения ALTER";
const MAIL_TEXT = (code: string) =>
  `Ваш код: ${code}\nДействует 10 минут. Если это были не вы — просто проигнорируйте письмо.`;

let eskizToken: { value: string; exp: number } | null = null;

function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "ALTER <noreply@alter.local>";
}

async function sendEmail(to: string, code: string) {
  const host = process.env.SMTP_HOST;
  const resendKey = process.env.RESEND_API_KEY;

  if (host) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: mailFrom(),
      to,
      subject: MAIL_SUBJECT,
      text: MAIL_TEXT(code),
    });
    console.log(`[OTP] email → ${maskEmail(to)} via smtp`);
    return;
  }

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [to],
        subject: MAIL_SUBJECT,
        text: MAIL_TEXT(code),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Не удалось отправить письмо (${res.status}): ${body.slice(0, 200)}`);
    }
    console.log(`[OTP] email → ${maskEmail(to)} via resend`);
    return;
  }

  if (devOutboxEnabled()) {
    writeOutbox("email", to, code);
    return;
  }

  throw new Error("Почта не настроена: укажите SMTP_HOST или RESEND_API_KEY в backend/.env");
}

async function eskizAuth() {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) return null;
  if (eskizToken && eskizToken.exp > Date.now()) return eskizToken.value;
  const res = await fetch("https://notify.eskiz.uz/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { data?: { token?: string }; message?: string };
  const token = data.data?.token;
  if (!res.ok || !token) {
    throw new Error(data.message || "Не удалось войти в Eskiz SMS");
  }
  eskizToken = { value: token, exp: Date.now() + 20 * 60 * 60 * 1000 };
  return token;
}

async function sendSms(to: string, code: string) {
  const digits = to.replace(/\D/g, "");
  const text = SMS_TEXT(code);

  const eskiz = await eskizAuth();
  if (eskiz) {
    const res = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${eskiz}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile_phone: digits,
        message: text,
        from: process.env.ESKIZ_FROM || "4546",
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Не удалось отправить SMS (${res.status}): ${body.slice(0, 200)}`);
    console.log(`[OTP] sms → ${maskPhone(to)} via eskiz`);
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to.startsWith("+") ? to : `+${digits}`, From: from, Body: text }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Не удалось отправить SMS (${res.status}): ${body.slice(0, 200)}`);
    console.log(`[OTP] sms → ${maskPhone(to)} via twilio`);
    return;
  }

  if (devOutboxEnabled()) {
    writeOutbox("phone", to, code);
    return;
  }

  throw new Error("SMS не настроено: укажите ESKIZ_EMAIL и ESKIZ_PASSWORD (или Twilio) в backend/.env");
}

export async function deliverOtp(channel: "email" | "phone", to: string, code: string) {
  if (channel === "email") {
    await sendEmail(to, code);
    return;
  }
  await sendSms(to, code);
}
