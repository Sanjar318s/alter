"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { finance } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/lib/LocaleContext";

export function WithdrawModal({
  available,
  onClose,
  onDone,
}: {
  available: number;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const { formatSum } = useLocale();
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Заявка на вывод" onClose={onClose}>
      <p className="text-[13px] text-ink-70 mb-3">
        Платёжный шлюз не подключён. Заявка уйдёт со статусом «ожидает подтверждения» и обрабатывается вручную.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const amount = Number(fd.get("amount"));
          setBusy(true);
          try {
            const res = await finance.withdraw({
              amount,
              method: String(fd.get("method")),
              details: String(fd.get("details")),
            });
            toast(res.message || "Заявка отправлена. Обрабатывается вручную.");
            onDone?.();
            onClose();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Не удалось отправить заявку", true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="font-mono text-[11px] text-ink-45">Доступно: {formatSum(available)}</p>
        <input name="amount" className="field" type="number" max={available} min={1} placeholder="Сумма" required />
        <select name="method" className="field-box">
          <option value="card">Карта</option>
          <option value="account">Счёт</option>
        </select>
        <textarea name="details" className="field-box" rows={3} placeholder="Реквизиты" required />
        <Button type="submit" disabled={busy || available < 1}>
          {busy ? "Отправка…" : "Отправить заявку"}
        </Button>
      </form>
    </Modal>
  );
}
