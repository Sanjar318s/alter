"use client";

import { useCallback, useEffect, useState } from "react";
import { adminPartners, type PartnerApplication, type PartnerPublic, type AdCampaign } from "@/lib/api";
import {
  AdminBadge,
  AdminHelpButton,
  AdminPanel,
  AdminPrimaryButton,
  AdminSectionTitle,
} from "@/components/admin/AdminUi";
import { useToast } from "@/components/ui/Toast";

const SLOTS = [
  { id: "home_hero_partner", label: "Главная" },
  { id: "explore_feed_sponsor", label: "Explore лента" },
  { id: "explore_sidebar_event", label: "Explore sidebar" },
];

export function AdminPartnersPanel({ onHelp }: { onHelp?: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"applications" | "partners" | "ads">("applications");
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [partners, setPartners] = useState<PartnerPublic[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [apps, pts] = await Promise.all([adminPartners.applications(), adminPartners.list()]);
      setApplications(apps.applications);
      setPartners(pts.partners);
      if (!selectedPartner && pts.partners[0]) setSelectedPartner(pts.partners[0].id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка загрузки", true);
    } finally {
      setLoading(false);
    }
  }, [selectedPartner, toast]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    if (!selectedPartner || !open) return;
    adminPartners.campaigns(selectedPartner).then((r) => setCampaigns(r.campaigns)).catch(() => setCampaigns([]));
  }, [selectedPartner, open]);

  async function approve(id: string) {
    try {
      const r = await adminPartners.approveApplication(id);
      toast(`Партнёр создан: ${r.slug}`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  async function reject(id: string) {
    try {
      await adminPartners.rejectApplication(id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  async function publishPartner(id: string) {
    try {
      await adminPartners.update(id, { status: "active", activeFrom: new Date().toISOString() });
      toast("Партнёр опубликован");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  async function createCampaign() {
    if (!selectedPartner) return;
    const name = prompt("Название кампании");
    if (!name) return;
    try {
      await adminPartners.createCampaign(selectedPartner, {
        name,
        status: "active",
        startsAt: new Date().toISOString(),
      });
      toast("Кампания создана");
      const r = await adminPartners.campaigns(selectedPartner);
      setCampaigns(r.campaigns);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  async function addPlacement(campaignId: string) {
    const slotId = prompt(`Slot ID:\n${SLOTS.map((s) => s.id).join(", ")}`, "explore_feed_sponsor");
    if (!slotId) return;
    const title = prompt("Заголовок креатива") || "Партнёр ALTER";
    const subtitle = prompt("Подзаголовок") || "";
    const ctaUrl = prompt("URL (например /partners/slug)") || "/partners";
    try {
      await adminPartners.createPlacement(campaignId, {
        slotId,
        creative: { title, subtitle, ctaLabel: "Подробнее", ctaUrl },
        weight: 100,
      });
      toast("Размещение добавлено");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  return (
    <AdminPanel className="p-4 mb-4" id="admin-partners">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <AdminSectionTitle title="Партнёры и реклама" helpOnClick={onHelp} helpLabel="Справка: партнёры" />
          <p className="text-[12px] text-ink-45 mt-1">Заявки, витрины, кампании и слоты.</p>
        </div>
        <div className="flex gap-2">
          {open && (
            <AdminPrimaryButton variant="outline" onClick={reload} disabled={loading}>
              Обновить
            </AdminPrimaryButton>
          )}
          <AdminPrimaryButton variant="outline" onClick={() => setOpen(!open)}>
            {open ? "Свернуть" : "Развернуть"}
          </AdminPrimaryButton>
        </div>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {(["applications", "partners", "ads"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] border ${
                  tab === t ? "border-magenta text-magenta bg-magenta/10" : "border-line text-ink-45"
                }`}
              >
                {t === "applications" ? "Заявки" : t === "partners" ? "Партнёры" : "Реклама"}
              </button>
            ))}
          </div>

          {tab === "applications" && (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {applications.filter((a) => a.status === "new" || a.status === "reviewing").length === 0 && (
                <p className="text-ink-45 text-[13px]">Нет новых заявок</p>
              )}
              {applications
                .filter((a) => a.status === "new" || a.status === "reviewing")
                .map((a) => (
                  <div key={a.id} className="border border-line rounded-[8px] p-3 bg-[#1a1828]/80">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{a.contactName}</div>
                        <div className="text-[12px] text-ink-45">
                          {a.type} · {a.city || "—"} · {a.contactEmail}
                        </div>
                        {a.message && <p className="text-[12px] text-ink-70 mt-2">{a.message}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <AdminPrimaryButton variant="purple" onClick={() => approve(a.id)}>
                          Одобрить
                        </AdminPrimaryButton>
                        <AdminPrimaryButton variant="outline" onClick={() => reject(a.id)}>
                          Отклонить
                        </AdminPrimaryButton>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === "partners" && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {partners.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-line rounded-[8px] p-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-ink-45 font-mono">
                      /partners/{p.slug} · {p.status}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <AdminBadge tone={p.status === "active" ? "green" : "neutral"}>{p.status}</AdminBadge>
                    {p.status !== "active" && (
                      <AdminPrimaryButton variant="purple" onClick={() => publishPartner(p.id)}>
                        Опубликовать
                      </AdminPrimaryButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "ads" && (
            <div>
              <select
                className="field-box text-[12px] mb-3 max-w-xs"
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <AdminPrimaryButton variant="purple" onClick={createCampaign} className="ml-2">
                Новая кампания
              </AdminPrimaryButton>
              <div className="space-y-2 mt-4">
                {campaigns.map((c) => (
                  <div key={c.id} className="border border-line rounded-[8px] p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-ink-45">
                          {c.status} · показы {c.stats?.impressions ?? 0} · клики {c.stats?.clicks ?? 0}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <AdminPrimaryButton variant="outline" onClick={() => addPlacement(c.id)}>
                          + Слот
                        </AdminPrimaryButton>
                        <a
                          href={adminPartners.reportCsvUrl(c.id)}
                          className="text-[12px] text-magenta self-center"
                          target="_blank"
                          rel="noreferrer"
                        >
                          CSV
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-45 mt-4 font-mono">Слоты: {SLOTS.map((s) => s.id).join(", ")}</p>
            </div>
          )}
        </>
      )}
      {onHelp && !open && <AdminHelpButton onClick={onHelp} label="Справка: партнёры" />}
    </AdminPanel>
  );
}
