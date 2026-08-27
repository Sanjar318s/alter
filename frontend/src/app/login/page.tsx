"use client";

import { FormEvent, Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { auth } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";
import { APP_FEED_HOME } from "@/lib/appHome";
import { isPlatformOwnerUser } from "@/lib/owner";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { login, user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const resetMode = sp.get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    const notice = sessionStorage.getItem("alter_block_notice") || "";
    if (notice) sessionStorage.removeItem("alter_block_notice");
    return notice;
  });
  const [pending, setPending] = useState(false);
  const [resetId, setResetId] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (loading) return;
    if (user?.platformRole || isPlatformOwnerUser(user)) router.replace(APP_FEED_HOME);
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(email, password);
      router.push(APP_FEED_HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const ident = email.trim();
      const res = ident.includes("@")
        ? await auth.resetRequest({ email: ident.toLowerCase() })
        : await auth.resetRequest({ phone: ident });
      setResetId(res.resetId || "");
      setHint(
        res.devCode
          ? `Код для разработки: ${res.devCode} (также в backend/data/outbox/)`
          : `Код отправлен на ${res.maskedTarget || ident}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await auth.resetConfirm({ resetId, code, newPassword });
      setHint("Пароль обновлён. Войдите с новым паролем.");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="hero-wash min-h-[calc(100dvh-57px)] px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start relative z-[1]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-magenta">
            {t("signIn")}
          </span>
          <h1 className="font-display font-extrabold text-[32px] md:text-[40px] mt-2 leading-tight">
            {t("signInTitle")}
          </h1>
          <ul className="mt-8 flex flex-col gap-4 list-none">
            {[
              {
                n: "01",
                t: t("signInHub"),
                d: t("signInHubText"),
              },
              {
                n: "02",
                t: t("studio"),
                d: t("signInStudioText"),
              },
              {
                n: "03",
                t: t("messages"),
                d: t("signInChatText"),
              },
            ].map((item) => (
              <li key={item.n} className="flex gap-4 border-b border-line pb-4">
                <span className="font-mono text-[12px] text-magenta">{item.n}</span>
                <div>
                  <div className="text-[15px] font-medium">{item.t}</div>
                  <div className="text-[13px] text-ink-70 mt-0.5">{item.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Frame className="bg-stage p-8 md:p-10">
          <h2 className="font-display font-extrabold text-[22px] mb-6">{resetMode ? t("resetPassword") : t("login")}</h2>
          {resetMode ? (
            <form onSubmit={resetId ? confirmReset : requestReset} className="flex flex-col gap-5">
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                  {t("emailOrPhone")}
                </span>
                <input
                  className="field mt-1"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {resetId && (
                <>
                  <input className="field" placeholder={t("codeFromMail")} value={code} onChange={(e) => setCode(e.target.value)} required />
                  <input className="field" type="password" placeholder={t("newPassword")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </>
              )}
              {hint && <p className="font-mono text-[12px] text-ink-70">{hint}</p>}
              {error && <p className="font-mono text-[12px] text-amber">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "…" : resetId ? t("savePassword") : t("sendCode")}
              </Button>
              <Link href="/login" className="text-[13px] text-ink-45">{t("backToLogin")}</Link>
            </form>
          ) : (
          <>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("emailOrPhone")}
              </span>
              <input
                className="field mt-1"
                type="text"
                required
                autoComplete="username"
                aria-autocomplete="list"
                placeholder={t("identPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                suppressHydrationWarning
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("password")}
              </span>
              <input
                className="field mt-1"
                type="password"
                required
                autoComplete="current-password"
                aria-autocomplete="list"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suppressHydrationWarning
              />
            </label>
            {error && (
              <p className="font-mono text-[12px] text-amber">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("signingIn") : t("login")}
            </Button>
          </form>
          <p className="text-[13px] text-ink-45 mt-6">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-paper hover:text-magenta">
              {t("create")}
            </Link>
            {" · "}
            <Link href="/login?reset=1" className="text-paper hover:text-magenta">
              {t("forgotPassword")}
            </Link>
            {" · "}
            <Link href="/explore" className="text-paper hover:text-magenta">
              {t("browseGuest")}
            </Link>
          </p>
          </>
          )}
        </Frame>
      </div>
    </div>
  );
}
