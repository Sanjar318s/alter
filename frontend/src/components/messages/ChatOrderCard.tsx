"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";
import { orders as ordersApi } from "@/lib/api";
import { REJECT_REASONS, statusLabel } from "@/lib/studio";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/lib/LocaleContext";

function parseOrderPayload(text?: string) {
  try {
    const p = JSON.parse(text || "");
    if (p && typeof p.orderId === "string") return p as { orderId: string };
  } catch {
    /* not json */
  }
  return null;
}

export function ChatOrderCard({ text }: { text?: string }) {
  const payload = parseOrderPayload(text);
  const { user } = useAuth();
  const { formatSum, t } = useLocale();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0].id);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payload?.orderId) return;
    ordersApi.get(payload.orderId).then((d) => setOrder(d.order)).catch(() => setOrder(null));
  }, [payload?.orderId]);

  if (!payload) {
    return <div className="text-[13px] break-words whitespace-pre-wrap">{text}</div>;
  }
  if (!order) {
    return <div className="text-[12px] text-ink-45">Заявка…</div>;
  }

  const photos: string[] = (() => {
    try {
      if (Array.isArray(order.filesJson)) return order.filesJson.filter((x: unknown) => typeof x === "string");
      const parsed = order.filesJson ? JSON.parse(order.filesJson) : [];
      return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();
  const cover = order.coverImage || photos[0];
  const isMaker = order.makerId === user?.id || order.viewerRole === "maker";
  const isClient = order.viewerRole === "client" || order.clientId === user?.id;
  const canMakerAct = isMaker && order.status === "new";
  const canClientWait = isClient && order.status === "waiting";

  async function act(action: "accept" | "wait" | "reject" | "confirm_wait", extra?: { reason?: string; details?: string }) {
    setBusy(true);
    try {
      const res = await ordersApi.decide(order.id, { action: action as any, ...extra });
      setOrder(res.order);
      setRejectOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame className="p-3 bg-ink/40 w-[min(100%,280px)]">
      {cover && (
        <div className="h-28 overflow-hidden mb-2 border border-line">
          <SmartImage src={cover} alt={order.title} fallback={order.title} />
        </div>
      )}
      <div className="font-display font-bold text-[14px]">{order.title || order.character}</div>
      {order.character && order.character !== order.title && (
        <div className="font-mono text-[11px] text-ink-45">{order.character}</div>
      )}
      <div className="text-[12px] text-ink-70 mt-1 space-y-0.5">
        {order.budget != null && <p>{t("budget")}: {formatSum(order.budget)}</p>}
        {order.deadline && <p>Срок до {new Date(order.deadline).toLocaleDateString("ru")}</p>}
        {order.notes && <p className="whitespace-pre-wrap">{order.notes}</p>}
      </div>
      <div className="font-mono text-[10px] uppercase text-magenta mt-2">{statusLabel(order.status)}</div>
      {canMakerAct && (
        <div className="flex flex-col gap-1.5 mt-3">
          <Button size="sm" disabled={busy} onClick={() => act("accept")}>Принять</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("wait")}>Ожидание</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen((v) => !v)}>Отклонить</Button>
        </div>
      )}
      {canClientWait && (
        <div className="flex flex-col gap-1.5 mt-3">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("reject", { details: "не ждать" })}>
            Отклонить без ожидания
          </Button>
          <Button size="sm" disabled={busy} onClick={() => act("confirm_wait")}>Подождать</Button>
        </div>
      )}
      {rejectOpen && (
        <div className="mt-2 flex flex-col gap-2">
          <select className="field-box text-[12px]" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECT_REASONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <textarea className="field-box text-[12px]" rows={2} placeholder="Описание" value={details} onChange={(e) => setDetails(e.target.value)} />
          <Button size="sm" disabled={busy || !details.trim()} onClick={() => act("reject", { reason, details })}>
            Отправить отказ
          </Button>
        </div>
      )}
    </Frame>
  );
}

export function isOrderMessage(type?: string, text?: string) {
  if (type === "order") return true;
  return Boolean(parseOrderPayload(text));
}
