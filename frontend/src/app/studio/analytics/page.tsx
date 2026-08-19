"use client";

import { useEffect, useState } from "react";
import { StudioShell } from "@/components/StudioShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { analytics } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AnalyticsPage() {
  const toast = useToast();
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analytics
      .studio(period)
      .then(setData)
      .catch((e) => toast(e.message, true))
      .finally(() => setLoading(false));
  }, [period, toast]);

  return (
    <StudioShell>
      <div className="p-4 sm:p-6">
        <PageHeader eyebrow="Аналитика" title="Заказы, доход и аудитория" />
        <div className="flex gap-2 mb-6">
          {["7d", "30d", "90d", "year"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-[12px] border ${period === p ? "border-magenta text-paper" : "border-line text-ink-45"}`}
            >
              {p}
            </button>
          ))}
        </div>
        {loading && <p className="font-mono text-[12px] text-ink-45">Загрузка…</p>}
        {data && data.ordersCount === 0 && <EmptyState title="Аналитика появится после первых заказов" />}
        {data && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-line p-4">
              <div className="font-mono text-[11px] text-ink-45 mb-2">Заказы по статусам</div>
              {Object.entries(data.byStatus || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[13px] py-1">
                  <span>{k}</span><span>{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="border border-line p-4">
              <div className="font-mono text-[11px] text-ink-45 mb-2">Доход по месяцам</div>
              {Object.entries(data.incomeByMonth || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[13px] py-1">
                  <span>{k}</span><span>{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="border border-line p-4">
              <div className="text-[13px]">Конверсия в оплату: {data.conversion}%</div>
              <div className="text-[13px] mt-2">Новых подписчиков: {data.followerGrowth}</div>
              <div className="text-[13px] mt-2">
                Среднее время ответа: {data.avgReplyMs != null ? `${Math.round(data.avgReplyMs / 60000)} мин` : "нет данных"}
              </div>
            </div>
            <div className="border border-line p-4">
              <div className="font-mono text-[11px] text-ink-45 mb-2">Топ франшиз</div>
              {(data.topCategories || []).map((c: any) => (
                <div key={c.name} className="flex justify-between text-[13px] py-1">
                  <span>{c.name}</span><span>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudioShell>
  );
}
