"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { VerifyCodeModal } from "@/components/auth/VerifyCodeModal";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/LocaleContext";

export default function RegisterPage() {
  const { startRegister, verifyRegister, resendRegister } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [roles, setRoles] = useState<string[]>(["cosplayer"]);
  const [pending, setPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [otp, setOtp] = useState<{
    pendingId: string;
    channel: "email" | "phone";
    maskedTarget: string;
    resendIn: number;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await startRegister({
        username,
        password,
        roleFlags: roles.join(",") || "cosplayer",
        method,
        email: method === "email" ? email : undefined,
        phone: method === "phone" ? phone : undefined,
      });
      setOtp({
        pendingId: res.pendingId,
        channel: res.channel,
        maskedTarget: res.maskedTarget,
        resendIn: res.resendIn,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать профиль");
    } finally {
      setPending(false);
    }
  }

  async function onVerify(code: string) {
    if (!otp || verifyPending) return;
    setVerifyError("");
    setVerifyPending(true);
    try {
      const user = await verifyRegister(otp.pendingId, code);
      router.push(`/profile/${user.username}`);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Неверный код");
    } finally {
      setVerifyPending(false);
    }
  }

  async function onResend() {
    if (!otp) return;
    setVerifyError("");
    try {
      const res = await resendRegister(otp.pendingId);
      setOtp({
        pendingId: res.pendingId,
        channel: res.channel,
        maskedTarget: res.maskedTarget,
        resendIn: res.resendIn,
      });
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Не удалось отправить код");
    }
  }

  return (
    <div className="hero-wash min-h-[calc(100dvh-57px)] px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start relative z-[1]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-magenta">
            {t("registerEyebrow")}
          </span>
          <h1 className="font-display font-extrabold text-[32px] md:text-[40px] mt-2 leading-tight">
            {t("heroTitle")}
          </h1>
          <p className="text-ink-70 mt-4 max-w-[480px] leading-relaxed">
            {t("registerLead")}
          </p>
          <ul className="mt-8 flex flex-col gap-4 list-none">
            {[
              t("registerBullet1"),
              t("registerBullet2"),
              t("registerBullet3"),
            ].map((line) => (
              <li
                key={line}
                className="text-[14px] text-paper border-b border-line pb-3 before:content-['✓_'] before:text-magenta"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>

        <Frame className="bg-stage p-8 md:p-10">
          <h2 className="font-display font-extrabold text-[22px] mb-6">
            {t("createProfile")}
          </h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("method")}
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([
                  { id: "email" as const, label: "Email" },
                  { id: "phone" as const, label: t("phone") },
                ]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "py-2.5 text-[13px] rounded-[4px] border transition-colors",
                      method === m.id
                        ? "border-magenta text-paper bg-magenta/15 shadow-[0_0_12px_rgba(229,72,122,0.2)]"
                        : "border-line text-ink-45 bg-transparent hover:text-paper"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("username")}
              </span>
              <input
                className="field mt-1"
                type="text"
                required
                minLength={3}
                autoComplete="username"
                aria-autocomplete="list"
                placeholder="nyx.cosplay"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                suppressHydrationWarning
              />
            </label>
            {method === "email" ? (
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                  Email
                </span>
                <input
                  className="field mt-1"
                  type="email"
                  required
                  autoComplete="email"
                  aria-autocomplete="list"
                  placeholder="you@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  suppressHydrationWarning
                />
              </label>
            ) : (
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                  Номер телефона
                </span>
                <input
                  className="field mt-1"
                  type="tel"
                  required
                  autoComplete="tel"
                  aria-autocomplete="list"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  suppressHydrationWarning
                />
              </label>
            )}
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("password")}
              </span>
              <input
                className="field mt-1"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                aria-autocomplete="list"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suppressHydrationWarning
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-45">
                {t("roles")}
              </span>
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { id: "cosplayer", label: t("cosplayer") },
                  { id: "maker", label: t("maker") },
                  { id: "photographer", label: t("photographer") },
                ].map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roles.includes(r.id)}
                      onChange={() =>
                        setRoles((prev) =>
                          prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                        )
                      }
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </label>
            {error && (
              <p className="font-mono text-[12px] text-amber">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Отправляем код…" : "Получить код"}
            </Button>
          </form>
          <p className="text-[13px] text-ink-45 mt-6">
            {t("alreadyAccount")}{" "}
            <Link href="/login" className="text-paper hover:text-magenta">
              {t("login")}
            </Link>
          </p>
        </Frame>
      </div>

      {otp && (
        <VerifyCodeModal
          channel={otp.channel}
          maskedTarget={otp.maskedTarget}
          resendIn={otp.resendIn}
          error={verifyError}
          pending={verifyPending}
          onVerify={onVerify}
          onResend={onResend}
          onClose={() => { setOtp(null); setVerifyError(""); }}
        />
      )}
    </div>
  );
}
