"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

function riskTone(level?: string) {
  if (level === "high") return "text-[#ff5b7f] border-[#ff5b7f]/50 bg-[#ff5b7f]/10";
  if (level === "medium") return "text-amber border-amber/50 bg-amber/10";
  return "text-[#6ee7b7] border-[#6ee7b7]/50 bg-[#6ee7b7]/10";
}

function orderStatusLabel(status: string) {
  if (status === "in_progress") return "В работе";
  if (status === "fitting") return "Примерка";
  if (status === "done") return "Готово";
  if (status === "archive") return "Архив";
  if (status === "discussion") return "Обсуждение";
  if (status === "shipped") return "Отправлено";
  if (status === "cancelled") return "Отменён";
  return status;
}

export function UserDossierModal({
  summary,
  expandedTopChats,
  expandedOrders,
  activeOrderStatus,
  onClose,
  onToggleTopChat,
  onToggleOrder,
  onOrderStatusChange,
}: {
  summary: any;
  expandedTopChats: Record<string, boolean>;
  expandedOrders: Record<string, boolean>;
  activeOrderStatus: string | null;
  onClose: () => void;
  onToggleTopChat: (conversationId: string) => void;
  onToggleOrder: (orderId: string) => void;
  onOrderStatusChange: (status: string | null) => void;
}) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-4xl mx-auto panel border border-line p-4 md:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-45">Досье пользователя</p>
            <h3 className="font-display text-[24px] leading-none mt-1">@{summary.user.username}</h3>
            <p className="text-[12px] text-ink-45 mt-2">
              {summary.user.email || "email не указан"}
              {summary.user.phone ? ` · ${summary.user.phone}` : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px] mb-4">
          <div className={`panel p-3 border ${riskTone(summary.risk.level)}`}>
            <p className="font-mono text-[11px] uppercase tracking-wide opacity-80">Риск</p>
            <p className="font-display text-[22px] mt-1 uppercase">{summary.risk.level}</p>
            <p className="text-[12px] mt-1">Скор: {summary.risk.score}</p>
          </div>
          <div className="panel p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-45">Жалобы</p>
            <p className="font-display text-[22px] mt-1">{summary.violations.reportsTotal}</p>
            <p className="text-[12px] text-ink-45 mt-1">всего за всё время</p>
          </div>
          <div className="panel p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-45">Нецензурная лексика</p>
            <p className="font-display text-[22px] mt-1">{summary.violations.profanityCount}</p>
            <p className="text-[12px] text-ink-45 mt-1">future-only события</p>
          </div>
          <div className="panel p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-45">Подозрительных</p>
            <p className="font-display text-[22px] mt-1">{summary.violations.suspiciousCount}</p>
            <p className="text-[12px] text-ink-45 mt-1">high severity</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 text-[13px]">
          <div className="panel p-4">
            <p className="font-semibold mb-3">Нарушения и быстрые метрики</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-ink/60 border border-line rounded-[4px] p-2.5">
                <p className="text-[11px] text-ink-45">Жалобы</p>
                <p className="font-display text-[20px]">{summary.violations.reportsTotal}</p>
              </div>
              <div className="bg-ink/60 border border-line rounded-[4px] p-2.5">
                <p className="text-[11px] text-ink-45">Нецензурная лексика</p>
                <p className="font-display text-[20px]">{summary.violations.profanityCount}</p>
              </div>
              <div className="bg-ink/60 border border-line rounded-[4px] p-2.5">
                <p className="text-[11px] text-ink-45">Подозрительных</p>
                <p className="font-display text-[20px]">{summary.violations.suspiciousCount}</p>
              </div>
              <div className="bg-ink/60 border border-line rounded-[4px] p-2.5">
                <p className="text-[11px] text-ink-45">Удалённых действий</p>
                <p className="font-display text-[20px]">{summary.violations.deletedActionsCount}</p>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <p className="font-semibold mb-3">Топ чатов</p>
            {(summary.topChats || []).length === 0 ? (
              <p className="text-ink-45">Нет активных чатов с большим числом сообщений</p>
            ) : (
              <div className="space-y-2">
                {(summary.topChats || []).map((c: any) => (
                  <div key={c.conversationId} className="bg-ink/60 border border-line rounded-[4px] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-paper font-semibold truncate">{c.title || c.conversationId}</p>
                        <p className="font-mono text-[10px] uppercase text-ink-45 mt-0.5">
                          {c.kind === "channel" ? "Канал" : c.kind === "group" ? "Групповой чат" : "Личный чат"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-paper font-semibold">{c.count} сообщ.</p>
                        <button
                          type="button"
                          className="text-magenta text-[12px] bg-transparent border-0 p-0 hover:underline cursor-pointer"
                          onClick={() =>
                            router.push(
                              `${c.openPath}${c.openPath.includes("?") ? "&" : "?"}ghost=1&targetUser=${encodeURIComponent(summary.user.id)}`
                            )
                          }
                        >
                          Открыть чат
                        </button>
                      </div>
                    </div>
                    {(c.sampleMessages || []).length > 0 && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          className="text-[12px] text-ink-45 hover:text-paper bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => onToggleTopChat(c.conversationId)}
                        >
                          {expandedTopChats[c.conversationId]
                            ? "Скрыть сообщения"
                            : `Показать сообщения (${(c.sampleMessages || []).length})`}
                        </button>
                        {expandedTopChats[c.conversationId] && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {(c.sampleMessages || []).map((m: any) => (
                              <div key={m.id} className="border border-line/60 bg-ink/50 rounded-[4px] px-2.5 py-1.5">
                                <p className="text-[12px] text-paper line-clamp-3">{m.text || "—"}</p>
                                <p className="font-mono text-[10px] text-ink-45 mt-1">
                                  {m.createdAt
                                    ? new Date(m.createdAt).toLocaleString("ru-RU", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-4 lg:col-span-2">
            <p className="font-semibold mb-3">Заказы</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-45">Всего</span>
              <span className="font-display text-[24px] leading-none">{summary.orders.total}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.orders.byStatus || {}).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  className={`inline-flex items-center gap-2 border rounded-[999px] px-3 py-1 bg-ink/60 cursor-pointer ${
                    activeOrderStatus === k ? "border-magenta text-paper" : "border-line text-ink-45 hover:text-paper"
                  }`}
                  onClick={() => {
                    onOrderStatusChange(activeOrderStatus === k ? null : k);
                  }}
                >
                  <span className="text-ink-45">{orderStatusLabel(k)}</span>
                  <span className="font-semibold text-paper">{String(v)}</span>
                </button>
              ))}
            </div>
            {!activeOrderStatus ? (
              <p className="mt-4 text-[12px] text-ink-45">
                Нажмите на статус, чтобы развернуть список заказов пользователя.
              </p>
            ) : (
              <div className="mt-4">
                <p className="font-mono text-[11px] uppercase tracking-wide text-ink-45 mb-2">
                  {orderStatusLabel(activeOrderStatus)} · заказы пользователя
                </p>
                {(summary.orders.latest || []).filter((o: any) => o.status === activeOrderStatus).length === 0 ? (
                  <p className="text-ink-45">Нет заказов с этим статусом</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(summary.orders.latest || [])
                      .filter((o: any) => o.status === activeOrderStatus)
                      .map((o: any) => (
                        <div key={o.id} className="border border-line rounded-[4px] bg-ink/60 px-3 py-2.5">
                          <button
                            type="button"
                            className="w-full bg-transparent border-0 p-0 text-left cursor-pointer"
                            onClick={() => onToggleOrder(o.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-paper font-semibold truncate">
                                  {o.title || o.character || `Заказ ${o.id.slice(0, 8)}`}
                                </p>
                                <p className="text-[12px] text-ink-45 mt-0.5">
                                  Статус: {orderStatusLabel(o.status || "")}
                                </p>
                              </div>
                              <p className="text-[12px] text-ink-45 shrink-0">
                                {expandedOrders[o.id] ? "Скрыть" : "Подробнее"}
                              </p>
                            </div>
                          </button>
                          {expandedOrders[o.id] && (
                            <div className="mt-2 pt-2 border-t border-line/60">
                              <p className="text-[12px] text-ink-45">
                                {o.deadline
                                  ? `Дедлайн: ${new Date(o.deadline).toLocaleDateString("ru-RU")}`
                                  : "Дедлайн не указан"}
                              </p>
                              <div className="flex items-center gap-2 shrink-0 mt-2.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    router.push(
                                      `/studio?order=${encodeURIComponent(o.id)}&ghost=1&targetUser=${encodeURIComponent(summary.user.id)}`
                                    )
                                  }
                                >
                                  Открыть заказ
                                </Button>
                                {o.conversationId && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      router.push(
                                        `/messages/${encodeURIComponent(o.conversationId)}?ghost=1&targetUser=${encodeURIComponent(summary.user.id)}`
                                      )
                                    }
                                  >
                                    Чат
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
