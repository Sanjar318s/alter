/** Stable community rooms. No seed messages — users write here. */
export const BLACKLIST_CHANNEL_ID = "ch-blacklist";

export const COMMUNITY_ROOMS: {
  id: string;
  kind: "topic" | "region";
  title: string;
  order: number;
}[] = [
  { id: "ch-obshalka", kind: "topic", title: "# Общалка", order: 1 },
  { id: "ch-events", kind: "topic", title: "Информация о мероприятиях", order: 2 },
  { id: "ch-rules", kind: "topic", title: "! Правила!", order: 3 },
  { id: "ch-help", kind: "topic", title: "Спаси, Господи!?", order: 4 },
  { id: "ch-fest-photos", kind: "topic", title: "Фотографии с фестов", order: 5 },
  { id: "ch-art", kind: "topic", title: "Ваши рисунки", order: 6 },
  { id: "ch-games", kind: "topic", title: "Игры", order: 7 },
  { id: "ch-market", kind: "topic", title: "Барахолка", order: 8 },
  { id: "ch-memes", kind: "topic", title: "Похихикаем", order: 9 },
  { id: "ch-cosplays", kind: "topic", title: "Ваши косплеи", order: 10 },
  { id: "ch-crafts", kind: "topic", title: "Клуб очумелые ручки", order: 11 },
  { id: "ch-socials", kind: "topic", title: "Ваши соцсети", order: 12 },
  { id: "ch-gacha", kind: "topic", title: "китайские gacha-игрульки", order: 13 },
  { id: "ch-kids", kind: "topic", title: "Наши дети", order: 14 },
  { id: "ch-music", kind: "topic", title: "Музло", order: 15 },
  { id: "ch-cocosplay", kind: "topic", title: "Поиск сокосплееров", order: 16 },
  { id: "ch-sidejobs", kind: "topic", title: "Подработки для бедных студентов", order: 17 },
  { id: "ch-services", kind: "topic", title: "Услуги", order: 18 },
  { id: "ch-rental", kind: "topic", title: "Аренда костюмов/крафтов", order: 19 },
  { id: "ch-guides", kind: "topic", title: "Заметки и гайды", order: 20 },
  { id: "ch-blacklist", kind: "topic", title: "Черный список косплей комьюнити", order: 21 },
  { id: "ch-tashkent", kind: "region", title: "Ташкент", order: 1 },
  { id: "ch-kazakhstan", kind: "region", title: "Казахстан", order: 2 },
  { id: "ch-korea", kind: "region", title: "Корея", order: 3 },
  { id: "ch-america", kind: "region", title: "Америка", order: 4 },
  { id: "ch-japan", kind: "region", title: "Япония", order: 5 },
  { id: "ch-europe", kind: "region", title: "Европа", order: 6 },
  { id: "ch-russia", kind: "region", title: "Россия", order: 7 },
];

export function conversationIdForRoom(channelId: string) {
  return `conv-${channelId}`;
}
