export type CommentItem = {
  id: string;
  targetType: "build" | "publication";
  targetId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  parentId?: string | null;
  createdAt: string;
  replies?: CommentItem[];
};

function ago(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

const RAW: CommentItem[] = [
  {
    id: "c-jinx-1",
    targetType: "build",
    targetId: "jinx",
    userId: "u-luna",
    username: "luna.s",
    displayName: "Luna",
    text: "Цвета просто огонь. Какой краской красишь парик?",
    createdAt: ago(30),
    replies: [
      {
        id: "c-jinx-2",
        targetType: "build",
        targetId: "jinx",
        userId: "u-nyx",
        username: "nyx.cosplay",
        displayName: "Nyx",
        text: "Arctic Fox + термозащита, потом фиксирую лаком.",
        parentId: "c-jinx-1",
        createdAt: ago(28),
      },
    ],
  },
  {
    id: "c-jinx-3",
    targetType: "build",
    targetId: "jinx",
    userId: "u-victor",
    username: "victor.maker",
    displayName: "Victor",
    text: "Пропы на плече — EVA или worbla?",
    createdAt: ago(20),
  },
  {
    id: "c-jinx-4",
    targetType: "build",
    targetId: "jinx",
    userId: "u-raiden",
    username: "raiden.photo",
    displayName: "Raiden Photo",
    text: "Снимем это на CosFest, если ещё открыта запись.",
    createdAt: ago(8),
  },
  {
    id: "c-raiden-1",
    targetType: "build",
    targetId: "raiden",
    userId: "u-nyx",
    username: "nyx.cosplay",
    displayName: "Nyx",
    text: "Градиент на кимоно нереальный. Сколько слоёв краски?",
    createdAt: ago(40),
    replies: [
      {
        id: "c-raiden-2",
        targetType: "build",
        targetId: "raiden",
        userId: "u-luna",
        username: "luna.s",
        displayName: "Luna",
        text: "Три слоя airbrush + лак. Реф могу скинуть в лс.",
        parentId: "c-raiden-1",
        createdAt: ago(36),
      },
    ],
  },
  {
    id: "c-raiden-3",
    targetType: "build",
    targetId: "raiden",
    userId: "u-victor",
    username: "victor.maker",
    displayName: "Victor",
    text: "Наручи печатал на PETG, потом шпаклёвка.",
    createdAt: ago(12),
  },
  {
    id: "c-pub1-1",
    targetType: "publication",
    targetId: "pub-1",
    userId: "u-luna",
    username: "luna.s",
    displayName: "Luna",
    text: "Финальная примерка выглядит готовой к сцене 🔥",
    createdAt: ago(14),
  },
  {
    id: "c-pub1-2",
    targetType: "publication",
    targetId: "pub-1",
    userId: "u-raiden",
    username: "raiden.photo",
    displayName: "Raiden Photo",
    text: "Свет на золоте идеальный. Можно тег на фото?",
    createdAt: ago(9),
  },
  {
    id: "c-pub1-3",
    targetType: "publication",
    targetId: "pub-1",
    userId: "u-victor",
    username: "victor.maker",
    displayName: "Victor",
    text: "Корсет держит силуэт. Какая сетка внутри?",
    createdAt: ago(4),
    replies: [
      {
        id: "c-pub1-4",
        targetType: "publication",
        targetId: "pub-1",
        userId: "u-nyx",
        username: "nyx.cosplay",
        displayName: "Nyx",
        text: "Сетка стальная, 8 спиц. Потом гайд в заметках.",
        parentId: "c-pub1-3",
        createdAt: ago(3),
      },
    ],
  },
  {
    id: "c-pub2-1",
    targetType: "publication",
    targetId: "pub-2",
    userId: "u-luna",
    username: "luna.s",
    displayName: "Luna",
    text: "Пряди легли ровно, кайф.",
    createdAt: ago(11),
  },
  {
    id: "c-pub6-1",
    targetType: "publication",
    targetId: "pub-6",
    userId: "u-luna",
    username: "luna.s",
    displayName: "Luna",
    text: "Жду полный Yae. Когда дебют?",
    createdAt: ago(16),
  },
  {
    id: "c-pub6-2",
    targetType: "publication",
    targetId: "pub-6",
    userId: "u-victor",
    username: "victor.maker",
    displayName: "Victor",
    text: "Ушки уже заказал печатать 👀",
    createdAt: ago(5),
  },
];

export function demoCommentsFor(targetType: "build" | "publication", targetId: string): CommentItem[] {
  return RAW.filter((c) => c.targetType === targetType && c.targetId === targetId).map((c) => ({
    ...c,
    replies: c.replies || [],
  }));
}

export function countComments(list: CommentItem[]) {
  return list.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
}

export function formatCommentTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "сейчас";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
