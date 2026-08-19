"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partnerPortal, type PartnerPublic, type AdCampaign } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Frame } from "@/components/Frame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export default function PartnerPortalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<PartnerPublic[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<PartnerPublic | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    partnerPortal
      .list()
      .then((r) => {
        setList(r.partners);
        if (r.partners[0]) setSelected(r.partners[0].id);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!selected) return;
    partnerPortal
      .get(selected)
      .then((r) => {
        setDetail(r.partner);
        setDesc(r.partner.description || "");
        setCampaigns(r.campaigns);
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Ошибка", true));
  }, [selected, toast]);

  async function save() {
    if (!selected) return;
    try {
      await partnerPortal.update(selected, { description: desc });
      toast("Сохранено");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось сохранить", true);
    }
  }

  if (authLoading || loading) return <div className="p-8 font-mono text-ink-45">Загрузка…</div>;

  if (!list.length) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <EmptyState
          title="Нет партнёрских доступов"
          description="Кабинет открывается после одобрения заявки и привязки вашего аккаунта."
          action={<Button href="/partners">Подать заявку</Button>}
        />
      </div>
    );
  }

  return (
    <div className="pt-11 px-5 sm:px-8 pb-16 max-w-[900px] mx-auto">
      <h1 className="font-display font-extrabold text-2xl mb-2">Кабинет партнёра</h1>
      <p className="text-ink-70 text-[14px] mb-6">Редактирование витрины и просмотр статистики рекламы.</p>

      {list.length > 1 && (
        <select className="field-box mb-6 max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {detail && (
        <div className="space-y-8">
          <Frame className="p-5 bg-stage/50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-display font-bold text-lg">{detail.name}</div>
                <div className="font-mono text-[11px] text-ink-45 mt-1">
                  Статус: {detail.status} · Пакет: {detail.packageTier || "—"}
                </div>
              </div>
              <Link href={`/partners/${detail.slug}`} className="text-magenta text-[13px]">
                Публичная витрина →
              </Link>
            </div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45 mb-2">
              Описание
            </label>
            <textarea className="field-box min-h-[120px] w-full mb-3" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button onClick={save}>Сохранить</Button>
          </Frame>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-3">Рекламные кампании</h2>
            {campaigns.length === 0 ? (
              <p className="text-ink-45 text-[13px]">Кампании настраиваются командой ALTER после договора.</p>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <Frame key={c.id} className="p-4 bg-stage/40 flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="font-mono text-[11px] text-ink-45 mt-1">{c.status}</div>
                    </div>
                    <div className="font-mono text-[12px] text-ink-70">
                      Показы: {c.stats?.impressions ?? 0} · Клики: {c.stats?.clicks ?? 0} · CTR: {c.stats?.ctr ?? 0}%
                    </div>
                  </Frame>
                ))}
              </div>
            )}
          </section>

          <p className="text-[12px] text-ink-45 border-t border-line pt-4">
            Оплата и продление пакетов — через менеджера ALTER (B2B). Self-serve billing будет добавлен позже.
          </p>
        </div>
      )}
    </div>
  );
}
