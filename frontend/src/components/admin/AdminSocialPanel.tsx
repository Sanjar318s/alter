"use client";

import { useCallback, useEffect, useState } from "react";
import { adminSocial } from "@/lib/api";
import {
  AdminBadge,
  AdminPanel,
  AdminPrimaryButton,
  AdminSectionTitle,
} from "@/components/admin/AdminUi";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function AdminSocialPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [settings, setSettings] = useState<{
    tiktokAuditApproved: boolean;
    metaLiveMode: boolean;
    youtubeDailyUploadCap: number;
  } | null>(null);
  const [oauth, setOauth] = useState<{ youtube: boolean; meta: boolean; tiktok: boolean } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s, p] = await Promise.all([
        adminSocial.review(),
        adminSocial.settings(),
        adminSocial.posts(),
      ]);
      setReview(r.items || []);
      setSettings(s.settings);
      setOauth(s.oauth);
      setPosts(p.posts || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка загрузки соцсетей", true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function decide(id: string, decision: "approved" | "rejected") {
    try {
      await adminSocial.reviewDecision(id, decision);
      toast(decision === "approved" ? "Разрешено в соцсети" : "Репост отклонён");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  async function toggleSetting(key: "tiktokAuditApproved" | "metaLiveMode", value: boolean) {
    try {
      const r = await adminSocial.patchSettings({ [key]: value });
      setSettings(r.settings);
      toast("Настройки сохранены");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  function connect(provider: "youtube" | "meta" | "tiktok") {
    const token = localStorage.getItem("alter_token") || "";
    window.location.href = `${API_URL}/api/admin/social/${provider}/start?access_token=${encodeURIComponent(token)}`;
  }

  return (
    <AdminPanel className="p-4 mt-4">
      <AdminSectionTitle
        title="Соцсети бренда"
        right={
          <div className="flex gap-2">
            <AdminPrimaryButton
              onClick={async () => {
                try {
                  const r = await adminSocial.syncNow();
                  toast(`Синхронизировано: ${r.synced}`);
                  reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Ошибка sync", true);
                }
              }}
            >
              Sync now
            </AdminPrimaryButton>
            <AdminPrimaryButton onClick={() => reload()} disabled={loading}>
              Обновить
            </AdminPrimaryButton>
          </div>
        }
      />

      {!settings?.metaLiveMode && (
        <p className="text-[12px] text-amber-200/90 mb-3">
          Meta Development: посты видны только app testers.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["youtube", "meta", "tiktok"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-[#3a3550] px-3 py-1.5 text-[12px] text-paper bg-transparent cursor-pointer hover:border-[#7c3aed]/60"
            onClick={() => connect(p)}
          >
            Подключить {p === "youtube" ? "YouTube" : p === "meta" ? "Meta" : "TikTok"}
            {oauth?.[p] ? <AdminBadge tone="green">OK</AdminBadge> : <AdminBadge tone="amber">нет</AdminBadge>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-4 text-[13px] text-ink-70">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(settings?.tiktokAuditApproved)}
            onChange={(e) => toggleSetting("tiktokAuditApproved", e.target.checked)}
          />
          TikTok Audit approved (публичные посты)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(settings?.metaLiveMode)}
            onChange={(e) => toggleSetting("metaLiveMode", e.target.checked)}
          />
          Meta Live mode
        </label>
        {settings?.tiktokAuditApproved && (
          <AdminPrimaryButton
            onClick={async () => {
              try {
                const r = await adminSocial.tiktokRepublishPublic();
                toast(`В очереди репостов: ${r.queued}`);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Ошибка", true);
              }
            }}
          >
            Переопубликовать TikTok как публичные
          </AdminPrimaryButton>
        )}
      </div>

      <p className="text-[13px] font-semibold text-paper mb-2">Очередь review</p>
      {review.length === 0 ? (
        <p className="text-[12px] text-ink-45 mb-4">Пусто</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {review.map((item) => (
            <li key={item.id} className="border border-[#2f2b45] rounded-md p-3 flex gap-3">
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="w-14 h-14 object-cover rounded" />
              ) : (
                <div className="w-14 h-14 bg-[#12101a] rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-paper truncate">
                  @{item.username} · {item.contentType} · {item.caption || "—"}
                </p>
                <p className="text-[11px] text-ink-45 mt-1">{item.reason || "без причины"}</p>
                <div className="flex gap-2 mt-2">
                  <AdminPrimaryButton onClick={() => decide(item.id, "approved")}>
                    Разрешить в соцсети
                  </AdminPrimaryButton>
                  <button
                    type="button"
                    className="text-[12px] text-ink-45 bg-transparent border-0 cursor-pointer"
                    onClick={() => decide(item.id, "rejected")}
                  >
                    Отклонить репост
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] font-semibold text-paper mb-2">Последние посты</p>
      <ul className="space-y-1 max-h-48 overflow-auto">
        {posts.map((p) => (
          <li key={p.id} className="text-[11px] text-ink-45 flex gap-2">
            <span className="text-paper">{p.platform}</span>
            <span>{p.status}</span>
            {p.tiktokVisibility && <span>{p.tiktokVisibility}</span>}
            {p.externalUrl && (
              <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-magenta">
                link
              </a>
            )}
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
