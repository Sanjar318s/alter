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
