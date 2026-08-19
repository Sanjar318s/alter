"use client";

import { UI_CURRENCIES, UI_LANGUAGES } from "@/lib/locale/regions";
import { useLocale } from "@/lib/LocaleContext";
import { formatSum as formatUzs, uzsPerUnit } from "@/lib/format";

export function LocaleSettings() {
  const { lang, currency, setLang, setCurrency, rates, rateUpdated, t } = useLocale();
  const per = uzsPerUnit(currency, rates);
  return (
    <div className="p-3 flex flex-col gap-3 min-w-[240px]">
      <div className="font-display font-bold text-[14px]">{t("settings")}</div>
      <label className="text-[12px] text-ink-45">
        {t("language")}
        <select
          className="field-box mt-1"
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
      <label className="text-[12px] text-ink-45">
        {t("currency")}
        <select
          className="field-box mt-1"
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
        </p>
      )}
      {rateUpdated && (
        <p className="font-mono text-[10px] text-ink-45">{rateUpdated}</p>
      )}
    </div>
  );
}
