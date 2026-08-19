export type OrderStatus =
  | "new"
  | "waiting"
  | "discussion"
  | "in_progress"
  | "fitting"
  | "done"
  | "shipped"
  | "archive"
  | "cancelled";

export type OrderPerson = {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
};

export type OrderHistoryItem = {
  id?: string;
  status: string;
  note?: string | null;
  createdAt: string;
};

export type StudioOrder = {
  id: string;
  title: string;
  character: string;
  franchise: string;
  client: string;
  clientId?: string;
  clientUser?: OrderPerson | null;
  makerUser?: OrderPerson | null;
  viewerRole?: "maker" | "client";
  history?: OrderHistoryItem[];
  conversationId?: string | null;
  status: OrderStatus;
  deposit: number;
  budget: number;
  paid: number;
  deadline: string;
  notes: string;
  checklist: { id: string; label: string; done: boolean }[];
  pinned?: boolean;
  trackingNumber?: string;
  carrier?: string;
  coverImage?: string | null;
  cancelReason?: string;
  referenceUrls?: string[];
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новая заявка",
  waiting: "Ожидание",
  discussion: "Обсуждение",
  in_progress: "В работе",
  fitting: "Примерка",
  done: "Готово",
  shipped: "Отправлено",
  archive: "Архив",
  cancelled: "Отменён",
};

export const COLUMNS: { id: OrderStatus; title: string; hint: string }[] = [
  { id: "new", title: "Новые", hint: "Принять, отклонить или отложить" },
  { id: "waiting", title: "Ожидание", hint: "Нет слотов, клиент ждёт" },
  { id: "discussion", title: "Обсуждение", hint: "Согласовываем объём" },
  { id: "in_progress", title: "В работе", hint: "Кроим и собираем" },
  { id: "fitting", title: "Примерка", hint: "Посадка и правки" },
  { id: "done", title: "Готово", hint: "Ждёт отправку" },
  { id: "shipped", title: "Отправлено", hint: "У клиента" },
  { id: "archive", title: "Архив", hint: "Закрытые заказы" },
  { id: "cancelled", title: "Отменён", hint: "Отменённые" },
];

export const REJECT_REASONS = [
  { id: "no_slots", label: "Нет свободных слотов" },
  { id: "not_this_character", label: "Не берусь за этого персонажа" },
  { id: "budget", label: "Бюджет не подходит" },
  { id: "deadline", label: "Сроки нереальны" },
  { id: "other", label: "Другая причина" },
];

export const SEED_ORDERS: StudioOrder[] = [
  {
    id: "ord-jinx",
    title: "JINX",
    character: "JINX",
    franchise: "LEAGUE OF LEGENDS",
    client: "luna.s",
    status: "discussion",
    deposit: 0,
    budget: 450000,
    paid: 0,
    deadline: "2026-09-20",
    notes: "Ждём референсы крыльев.",
    checklist: [
      { id: "1", label: "Замеры", done: false },
      { id: "2", label: "Депозит", done: false },
      { id: "3", label: "Крой", done: false },
    ],
  },
  {
    id: "ord-raiden",
    title: "RAIDEN 2.5",
    character: "RAIDEN SHOGUN",
    franchise: "GENSHIN IMPACT",
    client: "luna.s",
    status: "in_progress",
    deposit: 240000,
    budget: 800000,
    paid: 240000,
    deadline: "2026-08-28",
    notes: "Усилить корсетные кости.",
    checklist: [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: true },
      { id: "3", label: "Крой", done: true },
      { id: "4", label: "Примерка", done: false },
    ],
  },
  {
    id: "ord-yae",
    title: "YAE MIKO",
    character: "YAE MIKO",
    franchise: "GENSHIN IMPACT",
    client: "luna.s",
    status: "fitting",
    deposit: 270000,
    budget: 900000,
    paid: 270000,
    deadline: "2026-09-05",
    notes: "Уши парика — отдельно.",
    checklist: [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: true },
      { id: "3", label: "Крой", done: true },
      { id: "4", label: "Примерка", done: true },
    ],
  },
  {
    id: "ord-2b",
    title: "2B",
    character: "2B",
    franchise: "NIER: AUTOMATA",
    client: "raiden.photo",
    status: "done",
    deposit: 186000,
    budget: 620000,
    paid: 620000,
    deadline: "2026-08-10",
    notes: "Готово к упаковке.",
    checklist: [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: true },
      { id: "3", label: "Крой", done: true },
      { id: "4", label: "Примерка", done: true },
      { id: "5", label: "Отправка", done: false },
    ],
  },
  {
    id: "ord-dva",
    title: "D.VA",
    character: "D.VA",
    franchise: "OVERWATCH",
    client: "victor.maker",
    status: "shipped",
    deposit: 114000,
    budget: 380000,
    paid: 380000,
    deadline: "2026-07-30",
    notes: "Трек-номер отправлен.",
    checklist: [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: true },
      { id: "3", label: "Крой", done: true },
      { id: "4", label: "Примерка", done: true },
      { id: "5", label: "Отправка", done: true },
    ],
  },
  {
    id: "ord-miku",
    title: "MIKU",
    character: "MIKU",
    franchise: "VOCALOID",
    client: "luna.s",
    status: "archive",
    deposit: 60000,
    budget: 200000,
    paid: 200000,
    deadline: "2026-06-01",
    notes: "Закрыт.",
    checklist: [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: true },
      { id: "3", label: "Отправка", done: true },
    ],
  },
];

export function orderCounterpart(o: StudioOrder): OrderPerson | null {
  if (o.viewerRole === "client") return o.makerUser || null;
  return o.clientUser || null;
}

export function statusLabel(status: string) {
  return STATUS_LABEL[status as OrderStatus] || status;
}

export function checklistPct(o: StudioOrder) {
  if (!o.checklist.length) return 0;
  return Math.round((o.checklist.filter((c) => c.done).length / o.checklist.length) * 100);
}

export function mapApiOrder(o: any): StudioOrder {
  let checklist: StudioOrder["checklist"] = [];
  try {
    checklist = o.checklistJson ? JSON.parse(o.checklistJson) : [];
  } catch {
    checklist = [];
  }
  const deadline = o.deadline ? new Date(o.deadline).toISOString().slice(0, 10) : "";
  const status = (COLUMNS.some((c) => c.id === o.status) ? o.status : "discussion") as OrderStatus;
  const clientUser = o.client && typeof o.client === "object" ? o.client : null;
  const makerUser = o.maker && typeof o.maker === "object" ? o.maker : null;
  return {
    id: o.id,
    title: o.title || "Заказ",
    character: o.character || o.title || "",
    franchise: o.franchise || "",
    client: clientUser?.username || o.requester?.username || "клиент",
    clientId: clientUser?.id || o.clientId,
    clientUser,
    makerUser,
    viewerRole: o.viewerRole === "client" ? "client" : "maker",
    history: Array.isArray(o.history) ? o.history : [],
    conversationId: o.conversationId,
    status,
    deposit: o.depositAmount || 0,
    budget: o.budget || 0,
    paid: o.paidAmount || 0,
    deadline,
    notes: o.notes || "",
    checklist,
    pinned: Boolean(o.pinned),
    trackingNumber: o.trackingNumber || "",
    carrier: o.carrier || "",
    coverImage: o.coverImage || (() => {
      try {
        const parsed = o.filesJson ? JSON.parse(o.filesJson) : [];
        return Array.isArray(parsed) ? parsed.find((x: unknown) => typeof x === "string") : null;
      } catch {
        return null;
      }
    })(),
    cancelReason: o.cancelReason || "",
    referenceUrls: (() => {
      try {
        const parsed = o.filesJson ? JSON.parse(o.filesJson) : [];
        return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === "string") : [];
      } catch {
        return [];
      }
    })(),
  };
}
