export function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const CUR_LABEL: Record<string, string> = {
  UZS: "сум",
  KZT: "₸",
  KRW: "₩",
  USD: "$",
  JPY: "¥",
  EUR: "€",
  RUB: "₽",
};

/** Approx. units of display currency per 1 UZS, used until live FX loads. */
export const FALLBACK_RATES: Record<string, number> = {
  UZS: 1,
  USD: 0.000078,
  EUR: 0.000072,
  RUB: 0.0071,
  KZT: 0.039,
  KRW: 0.106,
  JPY: 0.0116,
};

export type MoneyPrefs = {
  currency: string;
  locale: string;
  rates: Record<string, number>;
};

export function formatSum(n: number, prefs?: MoneyPrefs) {
  const currency = prefs?.currency || "UZS";
  const locale = prefs?.locale || "ru";
  const rates = { ...FALLBACK_RATES, ...(prefs?.rates || {}) };
  const amount = Number(n || 0);
  const rate = rates[currency] ?? 1;
  const converted = amount * rate;
  const loc =
    locale === "ja" ? "ja-JP" : locale === "ko" ? "ko-KR" : locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const label = CUR_LABEL[currency] || currency;
  const decimals = currency === "USD" || currency === "EUR" ? 2 : 0;
  return `${converted.toLocaleString(loc, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} ${label}`;
}

export function uzsPerUnit(currency: string, rates: Record<string, number>) {
  const rate = { ...FALLBACK_RATES, ...rates }[currency];
  if (!rate) return 0;
  return 1 / rate;
}

export function mediaSrc(url?: string | null, size: "full" | "card" | "thumb" = "full") {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (size === "full") return url;
  try {
    const isHttp = url.startsWith("http://") || url.startsWith("https://");
    const u = isHttp ? new URL(url) : null;
    const pathOnly = u ? u.pathname : url.split("?")[0];
    const m = pathOnly.match(/^(.*\/)?([^/]+?)(\.[a-z0-9]+)?$/i);
    if (!m) return url;
    const dir = m[1] || "";
    let stem = m[2];
    if (/-card$/i.test(stem) || /-thumb$/i.test(stem)) {
      stem = stem.replace(/-(card|thumb)$/i, "");
    }
    const nextPath = `${dir}${stem}-${size}.webp`;
    if (u) {
      u.pathname = nextPath;
      return u.toString();
    }
    const q = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    return nextPath + q;
  } catch {
    return url;
  }
}

