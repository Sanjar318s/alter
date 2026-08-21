"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { admin } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  blogger: "Блогер",
  seller: "Продавец",
};

export function AdminRoleChangePanel() {
  const toast = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await admin.roleChangeRequests("pending");
      setRequests(data.requests || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось загрузить заявки", true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    try {
      if (action === "approve") await admin.approveRoleChange(id);
      else await admin.rejectRoleChange(id);
      toast(action === "approve" ? "Роль изменена" : "Заявка отклонена");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  return (
    <section className="border border-line bg-stage p-4 mt-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-bold text-[16px]">Заявки на смену роли</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          Обновить
        </Button>
      </div>
      {loading && <p className="text-[13px] text-ink-45">Загрузка…</p>}
      {!loading && requests.length === 0 && (
        <p className="text-[13px] text-ink-45">Нет заявок в статусе pending</p>
      )}
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="border border-line/80 p-3">
            <div className="font-mono text-[12px] text-magenta">
              @{r.username || "?"} · {ROLE_LABEL[r.currentRole] || r.currentRole} →{" "}
              {ROLE_LABEL[r.requestedRole] || r.requestedRole}
            </div>
            <p className="text-[13px] mt-2">
              <span className="text-ink-45">Причина:</span> {r.reason}
            </p>
            <p className="text-[13px] mt-1">
              <span className="text-ink-45">Деятельность:</span> {r.activityExplanation}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => decide(r.id, "approve")}>
                Одобрить
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide(r.id, "reject")}>
                Отклонить
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
