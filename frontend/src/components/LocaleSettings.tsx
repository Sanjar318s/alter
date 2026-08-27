"use client";

import { UI_CURRENCIES, UI_LANGUAGES } from "@/lib/locale/regions";
import { useLocale } from "@/lib/LocaleContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSum as formatUzs, uzsPerUnit } from "@/lib/format";
import { isPlatformOwnerUser } from "@/lib/owner";
import { cn } from "@/lib/cn";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  blogger: "Блогер",
  seller: "Продавец",
};

function formatRateUpdated(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LocaleSettings({ compact = false }: { compact?: boolean }) {
  const { lang, currency, setLang, setCurrency, rates, rateUpdated, t } = useLocale();
  const { user } = useAuth();
  const per = uzsPerUnit(currency, rates);
  const isOwner = isPlatformOwnerUser(user);
  const roleKey = isOwner ? user?.platformRole ?? "seller" : user?.platformRole;
  const roleLabel = isOwner && !user?.platformRole
    ? "Владелец"
    : roleKey
      ? ROLE_LABEL[roleKey] || roleKey
      : null;
  const rateLabel = rateUpdated ? formatRateUpdated(rateUpdated) : null;

  return (
    <div className={cn("flex flex-col gap-3 min-w-[200px]", compact ? "p-0" : "p-3")}>
      {!compact && <div className="font-display font-bold text-[14px]">{t("settings")}</div>}
      {roleLabel && (
        <p className="text-[12px] text-ink-70 leading-snug">
          Роль: <span className="text-paper">{roleLabel}</span>
          {!isOwner && (
            <span className="block text-[11px] text-ink-45 mt-1">
              Смена — в профиле → «Безопасность».
            </span>
          )}
        </p>
      )}
      <label className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-45">
        {t("language")}
        <select
          className="field-box mt-1.5 text-[13px] normal-case tracking-normal font-sans"
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
        >
          {UI_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} · {l.region}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-45">
        {t("currency")}
        <select
          className="field-box mt-1.5 text-[13px] normal-case tracking-normal font-sans"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
        >
          {UI_CURRENCIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} {c.label} · {c.region}
            </option>
          ))}
        </select>
      </label>
      {currency !== "UZS" && per > 0 && (
        <p className="font-mono text-[10px] text-ink-45">
          {t("rate")}: 1 {currency} ≈ {formatUzs(per, { currency: "UZS", locale: lang, rates: { UZS: 1 } })}
          {rateLabel ? ` · ${rateLabel}` : ""}
        </p>
      )}
    </div>
  );
}
