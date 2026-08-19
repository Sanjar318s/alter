export type CommunityChannel = {
  id: string;
  group: "topic" | "region";
  order: number;
  icon: string;
  title: string;
  preview: { author: string; text: string; accent?: boolean };
  time: string;
  unread?: number;
  pinned?: boolean;
  locked?: boolean;
  hasMention?: boolean;
  members?: number;
  writeMode?: "members" | "owner_only" | "channel_admins";
  managerUsernames?: string[];
};

export type ChannelChip = "all" | "unread" | "mentions";

const TOPIC_CHANNELS: CommunityChannel[] = [
  { id: "ch-obshalka", group: "topic", order: 1, icon: "💬", title: "# Общалка", preview: { author: "", text: "" }, time: "" },
  { id: "ch-events", group: "topic", order: 2, icon: "🗓", title: "Информация о мероприятиях", preview: { author: "", text: "" }, time: "" },
  { id: "ch-rules", group: "topic", order: 3, icon: "📌", title: "! Правила!", preview: { author: "", text: "" }, time: "", pinned: true },
  { id: "ch-help", group: "topic", order: 4, icon: "⁉", title: "Спаси, Господи!?", preview: { author: "", text: "" }, time: "" },
  { id: "ch-fest-photos", group: "topic", order: 5, icon: "📸", title: "Фотографии с фестов", preview: { author: "", text: "" }, time: "" },
  { id: "ch-art", group: "topic", order: 6, icon: "🎨", title: "Ваши рисунки", preview: { author: "", text: "" }, time: "" },
  { id: "ch-games", group: "topic", order: 7, icon: "🎮", title: "Игры", preview: { author: "", text: "" }, time: "" },
  { id: "ch-market", group: "topic", order: 8, icon: "💰", title: "Барахолка", preview: { author: "", text: "" }, time: "" },
  { id: "ch-memes", group: "topic", order: 9, icon: "🥣", title: "Похихикаем", preview: { author: "", text: "" }, time: "" },
  { id: "ch-cosplays", group: "topic", order: 10, icon: "👗", title: "Ваши косплеи", preview: { author: "", text: "" }, time: "" },
  { id: "ch-crafts", group: "topic", order: 11, icon: "🛠", title: "Клуб очумелые ручки", preview: { author: "", text: "" }, time: "" },
  { id: "ch-socials", group: "topic", order: 12, icon: "🤳", title: "Ваши соцсети", preview: { author: "", text: "" }, time: "" },
  { id: "ch-gacha", group: "topic", order: 13, icon: "✨", title: "китайские gacha-игрульки", preview: { author: "", text: "" }, time: "" },
  { id: "ch-kids", group: "topic", order: 14, icon: "🍼", title: "Наши дети", preview: { author: "", text: "" }, time: "" },
  { id: "ch-music", group: "topic", order: 15, icon: "🎵", title: "Музло", preview: { author: "", text: "" }, time: "" },
  { id: "ch-cocosplay", group: "topic", order: 16, icon: "🔍", title: "Поиск сокосплееров", preview: { author: "", text: "" }, time: "" },
  { id: "ch-sidejobs", group: "topic", order: 17, icon: "💵", title: "Подработки для бедных студентов", preview: { author: "", text: "" }, time: "" },
  { id: "ch-services", group: "topic", order: 18, icon: "✈️", title: "Услуги", preview: { author: "", text: "" }, time: "" },
  { id: "ch-rental", group: "topic", order: 19, icon: "⭐", title: "Аренда костюмов/крафтов", preview: { author: "", text: "" }, time: "" },
  { id: "ch-guides", group: "topic", order: 20, icon: "📝", title: "Заметки и гайды", preview: { author: "", text: "" }, time: "" },
  { id: "ch-blacklist", group: "topic", order: 21, icon: "❗", title: "Черный список косплей комьюнити", preview: { author: "", text: "" }, time: "", locked: true, pinned: true },
];

const REGION_CHANNELS: CommunityChannel[] = [
  { id: "ch-tashkent", group: "region", order: 1, icon: "🇺🇿", title: "Ташкент", preview: { author: "", text: "" }, time: "" },
  { id: "ch-kazakhstan", group: "region", order: 2, icon: "🇰🇿", title: "Казахстан", preview: { author: "", text: "" }, time: "" },
  { id: "ch-korea", group: "region", order: 3, icon: "🇰🇷", title: "Корея", preview: { author: "", text: "" }, time: "" },
  { id: "ch-america", group: "region", order: 4, icon: "🇺🇸", title: "Америка", preview: { author: "", text: "" }, time: "" },
  { id: "ch-japan", group: "region", order: 5, icon: "🇯🇵", title: "Япония", preview: { author: "", text: "" }, time: "" },
  { id: "ch-europe", group: "region", order: 6, icon: "🇪🇺", title: "Европа", preview: { author: "", text: "" }, time: "" },
  { id: "ch-russia", group: "region", order: 7, icon: "🇷🇺", title: "Россия", preview: { author: "", text: "" }, time: "" },
];

export function getTopicChannels() {
  return [...TOPIC_CHANNELS].sort((a, b) => a.order - b.order);
}

export function getRegionChannels() {
  return [...REGION_CHANNELS].sort((a, b) => a.order - b.order);
}

export function getChannelById(id: string) {
  return [...TOPIC_CHANNELS, ...REGION_CHANNELS].find((c) => c.id === id);
}

export function getAllCatalogChannels() {
  return [...TOPIC_CHANNELS, ...REGION_CHANNELS];
}

export function isCatalogChannel(id: string) {
  return getAllCatalogChannels().some((c) => c.id === id);
}

export type AdminChannelRow = LiveChannelRow & {
  icon: string;
  group: "topic" | "region";
  pinned?: boolean;
  locked?: boolean;
  archived?: boolean;
  messagesCount?: number;
  relatedFranchise?: string | null;
  relatedEventDate?: string | null;
  isSystem?: boolean;
};

export function mergeAdminChannels(live: LiveChannelRow[]): AdminChannelRow[] {
  const catalog = getAllCatalogChannels();
  const byId = new Map(live.map((r) => [r.id, r]));
  const merged = catalog.map((ch) => {
    const row = byId.get(ch.id);
    return {
      id: ch.id,
      conversationId: row?.conversationId || "",
      kind: ch.group,
      group: ch.group,
      icon: ch.icon,
      title: row?.title || ch.title,
      writeMode: row?.writeMode || ch.writeMode || "members",
      sortOrder: Number(row?.sortOrder ?? ch.order ?? 0),
      managerUsernames: row?.managerUsernames || ch.managerUsernames || [],
      membersCount: row?.membersCount,
      messagesCount: (row as AdminChannelRow)?.messagesCount,
      lastMessage: row?.lastMessage,
      unread: row?.unread,
      pinned: ch.pinned,
      locked: ch.locked,
      archived: Boolean((row as AdminChannelRow)?.archived),
      relatedFranchise: (row as AdminChannelRow)?.relatedFranchise ?? null,
      relatedEventDate: (row as AdminChannelRow)?.relatedEventDate ?? null,
      isSystem: true,
    } satisfies AdminChannelRow;
  });
  const known = new Set(catalog.map((c) => c.id));
  const extras = live
    .filter((r) => !known.has(r.id))
    .map(
      (r): AdminChannelRow => ({
        ...r,
        group: r.kind === "region" ? "region" : "topic",
        icon: "💬",
        archived: Boolean((r as AdminChannelRow).archived),
        relatedFranchise: (r as AdminChannelRow).relatedFranchise ?? null,
        relatedEventDate: (r as AdminChannelRow).relatedEventDate ?? null,
        messagesCount: (r as AdminChannelRow).messagesCount,
        isSystem: false,
      })
    );
  return [...merged, ...extras].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title, "ru")
  );
}

export function filterChannels(
  channels: CommunityChannel[],
  opts: { query?: string; chip?: ChannelChip }
) {
  const q = opts.query?.trim().toLowerCase();
  return channels.filter((ch) => {
    if (q) {
      const hay = `${ch.title} ${ch.preview.author} ${ch.preview.text}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (opts.chip === "unread") return (ch.unread ?? 0) > 0;
    if (opts.chip === "mentions") return ch.hasMention === true;
    return true;
  });
}

export const TOPIC_CHANNEL_COUNT = TOPIC_CHANNELS.length;
export const REGION_CHANNEL_COUNT = REGION_CHANNELS.length;
export const COMMUNITY_CHANNEL_COUNT = TOPIC_CHANNELS.length + REGION_CHANNELS.length;

export type LiveChannelRow = {
  id: string;
  conversationId: string;
  title: string;
  kind: string;
  writeMode?: "members" | "owner_only" | "channel_admins";
  sortOrder?: number;
  managerUsernames?: string[];
  lastMessage?: { text?: string | null; type?: string; createdAt?: string; sender?: string } | null;
  unread?: number;
  membersCount?: number;
  messagesCount?: number;
  archived?: boolean;
  relatedFranchise?: string | null;
  relatedEventDate?: string | null;
};

function formatChannelTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function previewFromLive(row: LiveChannelRow): CommunityChannel["preview"] {
  const lm = row.lastMessage;
  if (!lm) return { author: "", text: "Пока нет сообщений" };
  const type = lm.type || "text";
  const text =
    type === "image"
      ? "Фото"
      : type === "voice"
        ? "Голосовое"
        : type === "video"
          ? "Видео"
          : type === "sticker"
            ? "Стикер"
            : type === "file"
              ? "Файл"
              : lm.text || "";
  return { author: lm.sender || "", text };
}

/** Catalog rooms + live last message / unread. No fake previews. */
export function overlayLiveChannels(catalog: CommunityChannel[], live: LiveChannelRow[]): CommunityChannel[] {
  const byId = new Map(live.map((r) => [r.id, r]));
  const overlaid = catalog.map((ch) => {
    const row = byId.get(ch.id);
    if (!row) return { ...ch, preview: { author: "", text: "Пока нет сообщений" } };
    return {
      ...ch,
      title: row.title || ch.title,
      preview: previewFromLive(row),
      time: formatChannelTime(row.lastMessage?.createdAt),
      unread: row.unread || undefined,
      members: row.membersCount,
      writeMode: row.writeMode || ch.writeMode,
      managerUsernames: row.managerUsernames || ch.managerUsernames,
      locked: row.writeMode === "owner_only" ? true : ch.locked,
      order: Number(row.sortOrder || ch.order || 0),
    };
  });
  const known = new Set([...TOPIC_CHANNELS, ...REGION_CHANNELS].map((c) => c.id));
  const group = catalog[0]?.group ?? "topic";
  const extras = live
    .filter((r) => !known.has(r.id) && (group === "region" ? r.kind === "region" : r.kind !== "region"))
    .map(
      (r): CommunityChannel => ({
        id: r.id,
        group,
        order: 999,
        icon: "💬",
        title: r.title,
        preview: previewFromLive(r),
        time: formatChannelTime(r.lastMessage?.createdAt),
        unread: r.unread || undefined,
        members: r.membersCount,
        writeMode: r.writeMode,
        managerUsernames: r.managerUsernames || [],
      })
    );
  return [...overlaid, ...extras].sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title, "ru"));
}
