"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { account } from "@/lib/api";
import { useAuth, type PlatformRole } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABEL: Record<PlatformRole, string> = {
  client: "Клиент",
  blogger: "Блогер",
  seller: "Продавец",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
};

export function RoleChangeRequestForm() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [requestedRole, setRequestedRole] = useState<PlatformRole>("seller");
  const [reason, setReason] = useState("");
  const [activity, setActivity] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  async function load() {
    try {
      const data = await account.roleChangeRequests();
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!user?.platformRole) return null;

  const pending = requests.find((r) => r.status === "pending");
  const options = (["client", "blogger", "seller"] as PlatformRole[]).filter(
    (r) => r !== user.platformRole
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pending) return;
    setBusy(true);
    try {
      await account.createRoleChangeRequest({
        requestedRole,
        reason: reason.trim(),
        activityExplanation: activity.trim(),
      });
      toast("Заявка отправлена модератору");
      setReason("");
      setActivity("");
      await load();
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось отправить", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-[480px] mt-8 pt-6 border-t border-line">
      <div>
        <h3 className="font-display font-bold text-[16px]">Заявка на смену роли</h3>
        <p className="text-[13px] text-ink-70 mt-1">
          Текущая роль: <span className="text-paper">{ROLE_LABEL[user.platformRole]}</span>. Смена
          возможна только после одобрения модератором.
        </p>
      </div>

      {pending ? (
        <p className="text-[13px] border border-amber/40 bg-amber/10 px-3 py-2 text-amber">
          Заявка на «{ROLE_LABEL[pending.requestedRole as PlatformRole] || pending.requestedRole}» уже
          на рассмотрении.
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <label className="text-[12px] text-ink-45">
            Новая роль
            <select
              className="field-box mt-1"
              value={requestedRole}
              onChange={(e) => setRequestedRole(e.target.value as PlatformRole)}
            >
              {options.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-ink-45">
            Причина
            <textarea
              className="field-box mt-1 min-h-[72px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={10}
              placeholder="Почему нужна смена роли"
            />
          </label>
          <label className="text-[12px] text-ink-45">
            Объяснение деятельности
            <textarea
              className="field-box mt-1 min-h-[96px]"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              required
              minLength={20}
              placeholder="Чем будете заниматься в новой роли"
            />
          </label>
          <Button type="submit" disabled={busy || !options.length}>
            {busy ? "Отправка…" : "Отправить заявку"}
          </Button>
        </form>
      )}

      {requests.length > 0 && (
        <ul className="text-[12px] text-ink-70 space-y-2">
          {requests.slice(0, 5).map((r) => (
            <li key={r.id} className="border-b border-line/60 pb-2">
              → {ROLE_LABEL[r.requestedRole as PlatformRole] || r.requestedRole}:{" "}
              {STATUS_LABEL[r.status] || r.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
