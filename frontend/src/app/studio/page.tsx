"use client";

import { Suspense, useEffect, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  CheckCircle,
  Clock,
  FileText,
  Heart,
  MessageCircle,
  MessagesSquare,
  Package,
  Send,
  Settings,
  X,
} from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { Frame } from "@/components/Frame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/LocaleContext";
import type { MsgKey } from "@/lib/locale/messages";
import { SmartImage } from "@/components/media/SmartImage";
import {
  COLUMNS,
  REJECT_REASONS,
  checklistPct,
  mapApiOrder,
  orderCounterpart,
  statusLabel,
  type OrderStatus,
  type StudioOrder,
} from "@/lib/studio";
import { admin, messages as messagesApi, orders as ordersApi } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

const STEPS = [
  { id: "new" as const, label: "Новая заявка", icon: FileText },
  { id: "waiting" as const, label: "Ожидание", icon: Clock },
  { id: "discussion" as const, label: "Обсуждение", icon: MessagesSquare },
  { id: "in_progress" as const, label: "В работе", icon: Settings },
  { id: "fitting" as const, label: "Примерка", icon: Package },
  { id: "done" as const, label: "Готово", icon: CheckCircle },
  { id: "shipped" as const, label: "Отправлено", icon: Send },
];

const ARCHIVED: OrderStatus[] = ["done", "shipped", "archive", "cancelled"];

export default function StudioPage() {
  return (
    <Suspense fallback={<SkeletonPage className="pt-6" />}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const toast = useToast();
  const { formatSum, t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const isGhostView = sp.get("ghost") === "1";
  const ghostTargetUser = sp.get("targetUser") || "";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [items, setItems] = useState<StudioOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<StudioOrder | null>(null);
  const [shipOpen, setShipOpen] = useState<StudioOrder | null>(null);
  const [filterCol, setFilterCol] = useState<OrderStatus | "">("");
  const [mobileCol, setMobileCol] = useState(0);
  const [ghostIntervene, setGhostIntervene] = useState(false);
  const [ghostCanIntervene, setGhostCanIntervene] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const canMutate = !isGhostView || (ghostIntervene && ghostCanIntervene);
  const ghostParams = isGhostView
    ? { ghost: true, intervene: ghostIntervene, targetUser: ghostTargetUser || undefined }
    : undefined;

  async function shareProfile() {
    const username = user?.username;
    if (!username) {
      toast("Войдите, чтобы поделиться профилем", true);
      return;
    }
    const url = `${window.location.origin}/profile/${username}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `AlterCosPlay · ${username}`, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    toast("Ссылка на профиль скопирована");
  }

  async function reload() {
    setError("");
    try {
      const res = await ordersApi.list({
        ghost: isGhostView,
        targetUser: ghostTargetUser || undefined,
      });
      const mapped = (res.orders || []).map(mapApiOrder);
      const isBuyerRole = user?.platformRole === "client" || user?.platformRole === "blogger";
      const roleFiltered = isBuyerRole
        ? mapped.filter((o) => o.viewerRole === "client" || o.clientId === user.id)
        : mapped;
      roleFiltered.sort((a, b) => Number(b.pinned) - Number(a.pinned));
      setItems(roleFiltered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [isGhostView, ghostTargetUser]);

  useEffect(() => {
    if (!isGhostView) return;
    admin
      .me()
      .then((m) => setGhostCanIntervene(Boolean(m.permissions?.canViewUsers || m.isOwner)))
      .catch(() => setGhostCanIntervene(false));
  }, [isGhostView]);

  useEffect(() => {
    const id = sp.get("order");
    if (!id || !items.length) return;
    const hit = items.find((o) => o.id === id);
    if (hit) setActive(hit);
  }, [sp, items]);

  const inWork = items.filter((o) => o.status === "in_progress").length;
  const overdue = items.filter((o) => o.deadline && new Date(o.deadline) < new Date() && o.status !== "archive" && o.status !== "shipped" && o.status !== "cancelled").length;
  const avg = items.length ? Math.round(items.reduce((s, o) => s + o.budget, 0) / items.length) : 0;

  async function move(id: string, status: OrderStatus) {
    if (!canMutate) {
      toast("Ghost view: сначала нажмите «Вмешаться»", true);
      return;
    }
    const order = items.find((o) => o.id === id);
    if (!order || order.viewerRole === "client") return;
    if (status === "done" && checklistPct(order) < 100) {
      if (!confirm("Чеклист не закрыт. Переместить в «Готово»?")) return;
    }
    if (status === "shipped") {
      setShipOpen(order);
      return;
    }
    const prev = items;
    setItems((p) => p.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      await ordersApi.update(id, { status }, ghostParams);
    } catch (e) {
      setItems(prev);
      toast(e instanceof Error ? e.message : "Не удалось сменить статус", true);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    if (!canMutate) return;
    const over = e.over?.id as OrderStatus | undefined;
    const id = String(e.active.id);
    if (over && COLUMNS.some((c) => c.id === over)) move(id, over);
  }

  function exportCsv() {
    const header = "id,title,client,status,budget,deposit,deadline\n";
    const rows = items
      .map((o) => `${o.id},${o.title},${o.client},${o.status},${o.budget},${o.deposit},${o.deadline}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "alter-orders.csv";
    a.click();
    toast("CSV скачан");
  }

  const boardItems = showCompleted
    ? items
    : items.filter((o) => !ARCHIVED.includes(o.status));
  const visible = filterCol ? boardItems.filter((o) => o.status === filterCol) : boardItems;
  const totalSum = items.reduce((s, o) => s + o.budget, 0);
  const boardColumns = showCompleted
    ? COLUMNS
    : COLUMNS.filter((c) => !ARCHIVED.includes(c.id));

  return (
    <StudioShell>
      <div className="p-4 sm:p-6 pb-16 min-w-0 max-w-full">
        {isGhostView && (
          <div className="mb-4 panel p-3 border border-magenta/40 bg-magenta/10 flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-paper">
              Ghost view: вы просматриваете заказ{ghostTargetUser ? ` пользователя ${ghostTargetUser}` : ""} как наблюдатель.
            </p>
            <Button
              size="sm"
              variant={ghostIntervene ? "danger" : "outline"}
              onClick={() => setGhostIntervene((v) => !v)}
              disabled={!ghostCanIntervene}
            >
              {ghostIntervene ? "Выйти из вмешательства" : "Вмешаться"}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            eyebrow="Студия продавца"
            title="Заказы от клиентов: статусы, сроки и переписка."
            className="mb-4"
          />
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <Stat n={String(inWork)} l="В работе" />
            <Stat n={String(overdue)} l="Просрочен" warn />
            <Stat n={`${Math.round(avg / 1000)}K`} l="Средний чек" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setFilterCol(s.id as OrderStatus)}
              className="flex items-center gap-1.5 text-[12px] text-ink-70 bg-transparent border-0 hover:text-paper"
            >
              <s.icon size={14} className="text-magenta" />
              {s.label}
              {i < STEPS.length - 1 && <span className="text-ink-45 mx-1">→</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex border-b border-line">
            <span className="px-4 py-2 text-[13px] border-b-2 border-magenta">Доска заказов</span>
            <a href="/studio/calendar" className="px-4 py-2 text-[13px] text-ink-45 no-underline">Календарь</a>
          </div>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-ink-70 cursor-pointer">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
            Показать завершённые
          </label>
          {filterCol && (
            <button type="button" className="text-[12px] text-magenta bg-transparent border-0" onClick={() => setFilterCol("")}>
              Сбросить фильтр
            </button>
          )}
        </div>

        <div className="xl:hidden flex flex-wrap gap-2 pb-3 mb-3">
          {boardColumns.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setMobileCol(i)}
              className={cn(
                "shrink-0 font-mono text-[11px] uppercase px-3 py-2 border rounded-[4px]",
                mobileCol === i ? "border-magenta text-magenta" : "border-line text-ink-45"
              )}
            >
              {c.title}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-[13px] text-amber">
            {error}{" "}
            <button type="button" className="text-magenta bg-transparent border-0" onClick={() => { setLoading(true); reload(); }}>
              Повторить
            </button>
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4" role="status" aria-label="Загрузка заказов">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-line p-3 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-[70%]" />
                <Skeleton className="h-3 w-[45%]" />
                <Skeleton className="h-20 w-full rounded-none" />
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && !error && (
          <EmptyState
            title="Пока нет заказов"
            description="Клиенты оставляют заявки с вашего профиля. Поделитесь ссылкой, чтобы получить первый заказ."
            action={
              <Button size="sm" variant="outline" onClick={shareProfile}>
                Поделиться профилем
              </Button>
            }
          />
        )}

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="hidden xl:grid xl:grid-cols-3 2xl:grid-cols-9 gap-3 min-w-0">
            {boardColumns.map((col) => (
              <Column
                key={col.id}
                col={col}
                cards={visible.filter((o) => o.status === col.id)}
                onOpen={setActive}
                readOnly={!canMutate}
              />
            ))}
          </div>
          <div className="xl:hidden min-w-0">
            <Column
              col={boardColumns[Math.min(mobileCol, boardColumns.length - 1)]}
              cards={visible.filter((o) => o.status === boardColumns[Math.min(mobileCol, boardColumns.length - 1)]?.id)}
              onOpen={setActive}
              readOnly={!canMutate}
            />
          </div>
        </DndContext>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-ink px-4 sm:px-6 py-2 pr-14 md:pr-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-45 min-w-0 z-10">
        <span>{canMutate ? "Перетащите карту между колонками" : "Ghost view: перетаскивание и редактирование отключены"}</span>
        <span>Всего заказов {items.length}</span>
        <span>{t("amount")} {formatSum(totalSum)}</span>
        <button type="button" className="ml-auto text-magenta bg-transparent border-0" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {active && (
        <Drawer
          order={active}
          onClose={() => setActive(null)}
          onChange={(next) => {
            setItems((prev) => prev.map((o) => (o.id === next.id ? next : o)));
            setActive(next);
          }}
          onMove={(s) => {
            move(active.id, s);
            setActive(null);
          }}
          readOnly={!canMutate}
          ghostQuery={isGhostView ? `?ghost=1${ghostTargetUser ? `&targetUser=${encodeURIComponent(ghostTargetUser)}` : ""}` : ""}
          ghostParams={ghostParams}
        />
      )}

      {shipOpen && (
        <Modal title="Данные отправки" onClose={() => setShipOpen(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await ordersApi.update(shipOpen.id, {
                  status: "shipped",
                  trackingNumber: String(fd.get("track") || ""),
                  carrier: String(fd.get("carrier") || ""),
                }, ghostParams);
                setItems((p) => p.map((o) => (o.id === shipOpen.id ? { ...o, status: "shipped" } : o)));
                setShipOpen(null);
              } catch (err) {
                toast(err instanceof Error ? err.message : "Не удалось сохранить отправку", true);
              }
            }}
          >
            <input name="track" className="field" placeholder="Трек-номер" required />
            <input name="carrier" className="field" placeholder="Служба доставки" />
            <Button type="submit">Отправить</Button>
          </form>
        </Modal>
      )}
    </StudioShell>
  );
}

function Stat({ n, l, warn }: { n: string; l: string; warn?: boolean }) {
  return (
    <div>
      <div className={cn("font-mono text-[24px] font-bold", warn && "text-amber")}>{n}</div>
      <div className="text-[11px] text-ink-45 uppercase">{l}</div>
    </div>
  );
}

function Column({
  col,
  cards,
  onOpen,
  readOnly,
}: {
  col: (typeof COLUMNS)[number];
  cards: StudioOrder[];
  onOpen: (o: StudioOrder) => void;
  readOnly?: boolean;
}) {
  const { t } = useLocale();
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const accent =
    col.id === "discussion" || col.id === "fitting" || col.id === "new" || col.id === "waiting"
      ? "amber"
      : col.id === "in_progress"
        ? undefined
        : col.id === "archive"
          ? "muted"
          : "success";
  return (
    <div ref={setNodeRef} className={cn("min-h-[200px]", isOver && "bg-stage/40")}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[11px] uppercase text-ink-45">
          {t(`col_${col.id}` as MsgKey)} <span className="text-paper">{cards.length}</span>
        </div>
      </div>
      <div className="text-[11px] text-ink-45 mb-3 pb-2 border-b border-line">{col.hint}</div>
      {cards.length === 0 ? (
        <EmptyState compact title="Нет заказов" />
      ) : (
        cards.map((c) => <OrderCard key={c.id} order={c} accent={accent} onOpen={onOpen} readOnly={readOnly} />)
      )}
    </div>
  );
}

function OrderCard({
  order,
  accent,
  onOpen,
  readOnly,
}: {
  order: StudioOrder;
  accent?: "amber" | "muted" | "success";
  onOpen: (o: StudioOrder) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
    disabled: readOnly || order.viewerRole === "client" || order.status === "new" || order.status === "waiting",
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const { formatSum, t } = useLocale();
  const soon = order.deadline && new Date(order.deadline).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7;
  const late = Boolean(order.deadline && new Date(order.deadline) < new Date());
  const person = orderCounterpart(order);
  const nick = person?.username || order.client;
  const name = person?.displayName && person.displayName !== nick ? person.displayName : "";
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="w-full text-left mb-2.5 bg-transparent border-0 p-0"
      >
        <Frame amber={accent === "amber"} muted={accent === "muted"} success={accent === "success"} hover className="p-2.5 bg-stage">
          <div className="flex gap-2.5">
            <div className="w-[72px] h-[96px] shrink-0 overflow-hidden border border-line">
              <SmartImage src={order.coverImage || order.referenceUrls?.[0]} alt={order.title} fallback={order.title} />
            </div>
            <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="font-mono text-[10px] text-ink-45 truncate">{order.franchise || "Заказ"}</div>
            <span className="font-mono text-[10px] uppercase text-magenta shrink-0">{statusLabel(order.status)}</span>
          </div>
          <div className="font-display font-bold text-[13px]">{order.title}</div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 overflow-hidden border border-line">
              <SmartImage src={person?.avatarUrl} alt={nick} fallback={nick} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] truncate">@{nick}</span>
              {name && <span className="block text-[11px] text-ink-45 truncate">{name}</span>}
              <span className="block font-mono text-[10px] text-ink-45">
                {order.viewerRole === "client" ? "Исполнитель" : "Клиент"}
              </span>
            </span>
          </div>
          <div className="font-mono text-[10px] mt-1">{t("deposit")} {formatSum(order.deposit)}</div>
          {order.deadline && (
            <div className={cn("font-mono text-[10px]", late ? "text-amber" : soon ? "text-amber" : "text-ink-45")}>
              Дедлайн {order.deadline}
            </div>
          )}
            </div>
          </div>
        </Frame>
      </button>
    </div>
  );
}

function Drawer({
  order,
  onClose,
  onChange,
  onMove,
  readOnly,
  ghostQuery,
  ghostParams,
}: {
  order: StudioOrder;
  onClose: () => void;
  onChange: (o: StudioOrder) => void;
  onMove: (s: OrderStatus) => void;
  readOnly?: boolean;
  ghostQuery?: string;
  ghostParams?: { ghost?: boolean; intervene?: boolean; targetUser?: string };
}) {
  const toast = useToast();
  const router = useRouter();
  const { formatSum, t } = useLocale();
  const pct = checklistPct(order);
  const [payAmt, setPayAmt] = useState(String(Math.max(0, order.budget - order.paid) || order.budget));
  const [track, setTrack] = useState(order.trackingNumber || "");
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("no_slots");
  const [rejectDetails, setRejectDetails] = useState("");
  const [decideBusy, setDecideBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const person = orderCounterpart(order);
  const nick = person?.username || order.client;
  const name = person?.displayName && person.displayName !== nick ? person.displayName : "";
  const isClient = order.viewerRole === "client";
  const canAct = !readOnly && !isClient;
  const peerId = person?.id;

  async function persist(patch: Record<string, unknown>, next: StudioOrder) {
    if (!canAct) return;
    try {
      const res = await ordersApi.update(order.id, patch, ghostParams);
      onChange(mapApiOrder(res.order));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не сохранилось", true);
    }
  }

  async function openChat() {
    try {
      if (order.conversationId) {
        router.push(`/messages/${order.conversationId}${ghostQuery || ""}`);
        return;
      }
      if (!peerId) return;
      const conv = await messagesApi.createConversation(peerId);
      if (canAct) await ordersApi.update(order.id, { conversationId: conv.conversationId }, ghostParams).catch(() => {});
      router.push(`/messages/${conv.conversationId}${ghostQuery || ""}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не открыть чат", true);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[380px] bg-stage border-l border-line overflow-y-auto p-5">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-display font-extrabold text-[22px]">{order.title}</div>
          <div className="font-mono text-[11px] text-ink-45">{order.franchise} · {statusLabel(order.status)}</div>
        </div>
        <IconButton label="Закрыть" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <Link href={`/profile/${nick}`} className="w-9 h-9 overflow-hidden border border-line shrink-0">
          <SmartImage src={person?.avatarUrl} alt={nick} fallback={nick} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${nick}`} className="text-[13px] text-paper no-underline hover:text-magenta">
            @{nick}{name ? ` · ${name}` : ""}
          </Link>
          <div className="font-mono text-[10px] text-ink-45">
            {isClient ? "Исполнитель" : "Клиент"} · <Link href={`/profile/${nick}`} className="text-magenta">профиль</Link>
          </div>
        </div>
      </div>
      {order.notes && <p className="mt-3 text-[13px] text-ink-70 whitespace-pre-wrap">{order.notes}</p>}
      {readOnly && (
        <div className="mt-3 border border-line rounded-[4px] px-3 py-2 text-[12px] text-ink-45">
          Режим просмотра: изменения отключены до включения «Вмешаться».
        </div>
      )}
      {(order.referenceUrls || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {order.referenceUrls!.map((url) => (
            <span key={url} className="w-16 h-16 overflow-hidden border border-line">
              <SmartImage src={url} alt="референс" fallback="ref" />
            </span>
          ))}
        </div>
      )}
      {canAct && (order.status === "new" || order.status === "waiting") && (
        <div className="flex flex-col gap-2 mt-4">
          <Button size="sm" disabled={decideBusy} onClick={async () => {
            setDecideBusy(true);
            try {
              const res = await ordersApi.decide(order.id, { action: "accept" }, ghostParams);
              onChange(mapApiOrder(res.order));
            } catch (e) {
              toast(e instanceof Error ? e.message : "Не удалось принять", true);
            } finally {
              setDecideBusy(false);
            }
          }}>Принять заказ</Button>
          {order.status === "new" && (
            <Button size="sm" variant="outline" disabled={decideBusy} onClick={async () => {
              setDecideBusy(true);
              try {
                const res = await ordersApi.decide(order.id, { action: "wait" }, ghostParams);
                onChange(mapApiOrder(res.order));
              } catch (e) {
                toast(e instanceof Error ? e.message : "Не удалось отложить", true);
              } finally {
                setDecideBusy(false);
              }
            }}>В ожидание</Button>
          )}
          <Button size="sm" variant="outline" disabled={decideBusy} onClick={() => setRejectOpen(true)}>Отклонить</Button>
          {rejectOpen && (
            <div className="border border-line p-3 flex flex-col gap-2">
              <select className="field-box" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                {REJECT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <textarea className="field-box" rows={3} placeholder="Опишите причину" value={rejectDetails} onChange={(e) => setRejectDetails(e.target.value)} />
              <Button size="sm" disabled={decideBusy || !rejectDetails.trim()} onClick={async () => {
                setDecideBusy(true);
                try {
                  const res = await ordersApi.decide(order.id, { action: "reject", reason: rejectReason, details: rejectDetails.trim() }, ghostParams);
                  onChange(mapApiOrder(res.order));
                  setRejectOpen(false);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Не удалось отклонить", true);
                } finally {
                  setDecideBusy(false);
                }
              }}>Подтвердить отказ</Button>
            </div>
          )}
        </div>
      )}
      {!readOnly && isClient && (order.status === "waiting" || order.status === "new") && (
        <Button size="sm" variant="outline" className="mt-4" disabled={decideBusy} onClick={async () => {
          if (!confirm("Отменить заявку?")) return;
          setDecideBusy(true);
          try {
            const res = await ordersApi.decide(order.id, { action: "reject", details: "Не хочу ждать" }, ghostParams);
            onChange(mapApiOrder(res.order));
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось отменить", true);
          } finally {
            setDecideBusy(false);
          }
        }}>Отменить заявку</Button>
      )}
      {order.cancelReason && (
        <p className="mt-3 text-[12px] text-amber">Отказ: {order.cancelReason}</p>
      )}
      <label className="block mt-4 text-[12px] text-ink-45">
        Статус
        <select
          className="field-box mt-1"
          value={order.status}
          disabled={!canAct || order.status === "new" || order.status === "waiting"}
          onChange={(e) => onMove(e.target.value as OrderStatus)}
        >
          {COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>
      {canAct && order.status !== "new" && order.status !== "waiting" && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {COLUMNS.filter((c) => !["new", "waiting", "cancelled"].includes(c.id)).map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={order.status === c.id}
              onClick={() => onMove(c.id)}
              className={cn(
                "px-2 py-1 text-[11px] border bg-transparent",
                order.status === c.id ? "border-magenta text-magenta" : "border-line text-ink-45 hover:text-paper"
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <div className="font-mono text-[11px] uppercase text-ink-45 mb-2">История изменений</div>
        {(order.history || []).length === 0 ? (
          <p className="text-[12px] text-ink-45">Пока нет событий</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(order.history || []).map((h, i) => (
              <li key={h.id || `${h.status}-${i}`} className="text-[12px] border-b border-line pb-2">
                <div className="text-paper">{statusLabel(h.status)}{h.note && h.note !== "created" ? ` · ${h.note}` : h.note === "created" ? " · создан" : ""}</div>
                <div className="font-mono text-[10px] text-ink-45">
                  {h.createdAt ? new Date(h.createdAt).toLocaleString("ru") : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="block mt-3 text-[12px] text-ink-45">
        Дедлайн
        <input
          type="date"
          className="field-box mt-1"
          value={order.deadline}
          disabled={!canAct}
          onChange={(e) => persist({ deadline: e.target.value }, { ...order, deadline: e.target.value })}
        />
      </label>
      <label className="block mt-3 text-[12px] text-ink-45">
        Трек-номер
        <input className="field-box mt-1" value={track} disabled={!canAct} onChange={(e) => setTrack(e.target.value)} onBlur={() => persist({ trackingNumber: track, carrier }, order)} />
      </label>
      <label className="block mt-3 text-[12px] text-ink-45">
        Служба доставки
        <input className="field-box mt-1" value={carrier} disabled={!canAct} onChange={(e) => setCarrier(e.target.value)} onBlur={() => persist({ trackingNumber: track, carrier }, order)} />
      </label>
      <div className="mt-4 text-[13px] space-y-1">
        <div>{t("budget")} {formatSum(order.budget)}</div>
        <div className="text-success">{t("paid")} {formatSum(order.paid)}</div>
        <div>{t("remaining")} {formatSum(Math.max(0, order.budget - order.paid))}</div>
        <div className="h-1 bg-ink mt-2">
          <div className="h-1 bg-magenta" style={{ width: `${order.budget ? Math.min(100, (order.paid / order.budget) * 100) : 0}%` }} />
        </div>
        {canAct && (
          <>
            <input className="field mt-2" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
            <Button
              size="sm"
              className="mt-2"
              onClick={async () => {
                try {
                  const res = await ordersApi.pay(order.id, { amount: Number(payAmt), kind: "partial" }, ghostParams);
                  onChange(mapApiOrder(res.order));
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Платёж не сохранён", true);
                }
              }}
            >
              Отметить оплату
            </Button>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {canAct && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const res = await ordersApi.update(order.id, { pinned: !order.pinned }, ghostParams);
                onChange(mapApiOrder(res.order));
              } catch (e) {
                toast(e instanceof Error ? e.message : "Не удалось закрепить", true);
              }
            }}
          >
            <Heart size={14} className="mr-1" /> {order.pinned ? "Открепить" : "Закрепить"}
          </Button>
        )}
        <Button size="sm" onClick={openChat} disabled={!peerId && !order.conversationId}>
          <MessageCircle size={14} className="mr-1" /> Написать в личные
        </Button>
      </div>
      <div className="mt-5">
        <div className="font-mono text-[11px] text-ink-45 mb-2">Чеклист {pct}%</div>
        {order.checklist.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-[13px] py-1">
            <input
              type="checkbox"
              checked={c.done}
              disabled={isClient}
              onChange={() => {
                const checklist = order.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x));
                persist({ checklistJson: JSON.stringify(checklist) }, { ...order, checklist });
              }}
            />
            {c.label}
          </label>
        ))}
      </div>
      <textarea
        className="field-box mt-4"
        rows={4}
        value={order.notes}
        readOnly={!canAct}
        onBlur={(e) => persist({ notes: e.target.value }, { ...order, notes: e.target.value })}
        onChange={(e) => { if (canAct) onChange({ ...order, notes: e.target.value }); }}
      />
      {canAct && (
      <div className="flex flex-col gap-2 mt-4">
        {cancelOpen ? (
          <>
            <textarea className="field-box" rows={3} placeholder="Причина отмены" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button
              variant="danger"
              onClick={async () => {
                if (!reason.trim()) return;
                try {
                  await ordersApi.update(order.id, { status: "cancelled", cancelReason: reason }, ghostParams);
                  onMove("cancelled");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Не удалось отменить", true);
                }
              }}
            >
              Подтвердить отмену
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>Отменить заказ</Button>
        )}
      </div>
      )}
    </div>
  );
}
