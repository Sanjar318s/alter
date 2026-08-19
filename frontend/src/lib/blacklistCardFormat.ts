const DETAILS_LABELS: Record<string, string> = {
  manual_admin_block: "Блокировка через админ-панель",
  blacklist_admin: "Внесение в чёрный список через админ-панель",
};

function humanizeAutoDetails(raw: string) {
  if (!raw.includes("trigger=")) return raw;
  const parts = raw.split(";").map((p) => p.trim());
  return parts
    .map((part) => {
      if (part.startsWith("trigger=profanity")) return "Срабатывание: нецензурная лексика";
      if (part.startsWith("trigger=reports")) return "Срабатывание: много жалоб";
      if (part.startsWith("reports24h=")) return `Жалоб за 24 ч.: ${part.split("=")[1]}`;
      if (part.startsWith("profanity24h=")) return `Мат за 24 ч.: ${part.split("=")[1]}`;
      if (part.startsWith("score=")) return `Оценка риска: ${part.split("=")[1]}`;
      return part;
    })
    .join(" · ");
}

/** Переводит строки карточки (в т.ч. старые записи) на понятный русский. */
export function formatBlacklistCardLine(line: string): string {
  let out = line.trim();

  out = out.replace(/^Кем заблокирован:/i, "Кем:");
  out = out.replace(/Риск:\s*HIGH\b/i, "Риск: высокий");
  out = out.replace(/Риск:\s*WARN\b/i, "Риск: средний");
  out = out.replace(/Риск:\s*INFO\b/i, "Риск: низкий");
  out = out.replace(/\s*·\s*Source:\s*owner moderation/i, " · Источник: модерация владельца");
  out = out.replace(/\s*·\s*Source:\s*admin moderation/i, " · Источник: модерация админа");
  out = out.replace(/\s*·\s*Source:\s*([a-z_ ]+)/i, " · Источник: $1");

  if (out.startsWith("Детали:")) {
    const raw = out.slice("Детали:".length).trim();
    if (DETAILS_LABELS[raw]) return `Детали: ${DETAILS_LABELS[raw]}`;
    if (raw.includes("trigger=")) return `Детали: ${humanizeAutoDetails(raw)}`;
  }

  return out;
}
