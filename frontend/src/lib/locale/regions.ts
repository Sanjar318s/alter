export const UI_LANGUAGES = [
  { id: "ru", label: "Русский", region: "Россия" },
  { id: "uz", label: "Oʻzbekcha", region: "Ташкент" },
  { id: "en", label: "English", region: "Америка / Европа" },
  { id: "kk", label: "Қазақша", region: "Казахстан" },
  { id: "ko", label: "한국어", region: "Корея" },
  { id: "ja", label: "日本語", region: "Япония" },
] as const;

export const UI_CURRENCIES = [
  { id: "UZS", label: "сум", region: "Ташкент" },
  { id: "KZT", label: "₸", region: "Казахстан" },
  { id: "KRW", label: "₩", region: "Корея" },
  { id: "USD", label: "$", region: "Америка" },
  { id: "JPY", label: "¥", region: "Япония" },
  { id: "EUR", label: "€", region: "Европа" },
  { id: "RUB", label: "₽", region: "Россия" },
] as const;

export type UiLang = (typeof UI_LANGUAGES)[number]["id"];
export type UiCurrency = (typeof UI_CURRENCIES)[number]["id"];

export const DEFAULT_LANG: UiLang = "ru";
export const DEFAULT_CURRENCY: UiCurrency = "UZS";
