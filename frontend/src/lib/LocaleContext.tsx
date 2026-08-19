"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { account, auth } from "./api";
import { DICTS, type MsgKey } from "./locale/messages";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LANG,
  UI_CURRENCIES,
  UI_LANGUAGES,
  type UiCurrency,
  type UiLang,
} from "./locale/regions";
import { FALLBACK_RATES, formatSum as formatMoney, uzsPerUnit } from "./format";

const LANG_KEY = "alter_lang";
const CUR_KEY = "alter_currency";

type LocaleCtx = {
  lang: UiLang;
  currency: UiCurrency;
  rates: Record<string, number>;
  rateUpdated?: string;
  setLang: (l: UiLang) => void;
  setCurrency: (c: UiCurrency) => void;
  t: (key: MsgKey) => string;
  formatSum: (n: number) => string;
};

const Ctx = createContext<LocaleCtx | null>(null);

function readLang(): UiLang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const v = localStorage.getItem(LANG_KEY);
  return UI_LANGUAGES.some((l) => l.id === v) ? (v as UiLang) : DEFAULT_LANG;
}

function readCur(): UiCurrency {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  const v = localStorage.getItem(CUR_KEY);
  return UI_CURRENCIES.some((c) => c.id === v) ? (v as UiCurrency) : DEFAULT_CURRENCY;
}

function persistLocal(lang: UiLang, currency: UiCurrency) {
  localStorage.setItem(LANG_KEY, lang);
  localStorage.setItem(CUR_KEY, currency);
  document.cookie = `alter_lang=${lang};path=/;max-age=31536000;samesite=lax`;
  document.cookie = `alter_currency=${currency};path=/;max-age=31536000;samesite=lax`;
}

function persistRemote(lang: UiLang, currency: UiCurrency) {
  if (!localStorage.getItem("alter_token")) return;
  account.patch({ uiLocale: lang, uiCurrency: currency }).catch(() => {});
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(DEFAULT_LANG);
  const [currency, setCurState] = useState<UiCurrency>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [rateUpdated, setRateUpdated] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLangState(readLang());
    setCurState(readCur());
    setReady(true);
    const api = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${api}/api/fx`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates && Object.keys(d.rates).length > 1) {
          setRates({ ...FALLBACK_RATES, ...d.rates });
          if (d.updatedAt) setRateUpdated(d.updatedAt);
        }
      })
      .catch(() => {});
    if (localStorage.getItem("alter_token")) {
      auth
        .me()
        .then((d) => {
          const loc = d.profile?.uiLocale as UiLang | undefined;
          const cur = d.profile?.uiCurrency as UiCurrency | undefined;
          if (loc && UI_LANGUAGES.some((l) => l.id === loc)) {
            setLangState(loc);
            localStorage.setItem(LANG_KEY, loc);
          }
          if (cur && UI_CURRENCIES.some((c) => c.id === cur)) {
            setCurState(cur);
            localStorage.setItem(CUR_KEY, cur);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LocaleCtx>(() => {
    const mergedRates = { ...FALLBACK_RATES, ...rates };
    return {
      lang,
      currency,
      rates: mergedRates,
      rateUpdated,
      setLang: (l) => {
        setLangState(l);
        persistLocal(l, currency);
        persistRemote(l, currency);
      },
      setCurrency: (c) => {
        setCurState(c);
        persistLocal(lang, c);
        persistRemote(lang, c);
      },
      t: (key) => DICTS[lang][key] || DICTS.ru[key],
      formatSum: (n) => formatMoney(n, { currency, locale: lang, rates: mergedRates }),
    };
  }, [lang, currency, rates, rateUpdated]);

  return (
    <Ctx.Provider value={value}>
      <span className="hidden" data-locale-ready={ready ? "1" : "0"} />
      {children}
    </Ctx.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      lang: DEFAULT_LANG,
      currency: DEFAULT_CURRENCY,
      rates: FALLBACK_RATES,
      setLang: () => {},
      setCurrency: () => {},
      t: (key: MsgKey) => DICTS.ru[key],
      formatSum: (n: number) => formatMoney(n, { currency: DEFAULT_CURRENCY, locale: DEFAULT_LANG, rates: FALLBACK_RATES }),
    };
  }
  return ctx;
}

export { uzsPerUnit };
