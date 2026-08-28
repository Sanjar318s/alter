"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminSocial } from "@/lib/api";
import {
  AdminBadge,
  AdminPanel,
  AdminPrimaryButton,
  AdminSectionTitle,
} from "@/components/admin/AdminUi";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type SocialSettings = {
  tiktokAuditApproved: boolean;
  metaLiveMode: boolean;
  youtubeDailyUploadCap: number;
  publishYoutube: boolean;
  publishTiktok: boolean;
  publishInstagram: boolean;
  publishFacebook: boolean;
};

export function AdminSocialPanel() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [oauth, setOauth] = useState<{ youtube: boolean; meta: boolean; tiktok: boolean } | null>(null);
  const [publishPlatforms, setPublishPlatforms] = useState<{ publication: string[]; build: string[] } | null>(null);

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
      setPublishPlatforms(s.publishPlatforms || null);
      setPosts(p.posts || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка загрузки соцсетей", true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const social = searchParams.get("social");
    if (social === "youtube_connected") {
      toast("YouTube подключён — можно публиковать Shorts");
      router.replace("/admin", { scroll: false });
    }
  }, [searchParams, toast, router]);

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

  async function patchSettings(patch: Partial<SocialSettings>) {
    try {
      const r = await adminSocial.patchSettings(patch);
      setSettings(r.settings);
      toast("Настройки сохранены");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", true);
    }
  }

  function connectYoutube() {
    const token = localStorage.getItem("alter_token") || "";
    window.location.href = `${API_URL}/api/admin/social/youtube/start?access_token=${encodeURIComponent(token)}`;
  }

  const ytPosts = posts.filter((p) => p.platform === "youtube");

  return (
    <AdminPanel className="p-4 mt-4">
      <AdminSectionTitle
        title="YouTube Shorts (бренд AlterCosPlay)"
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
              Sync stats
            </AdminPrimaryButton>
            <AdminPrimaryButton onClick={() => reload()} disabled={loading}>
              Обновить
            </AdminPrimaryButton>
          </div>
        }
      />

      <p className="text-[12px] text-ink-45 mb-3">
        Рилсы с opt-in проходят модерацию (Gemini) и публикуются на канал бренда.
        Сейчас включена только <strong className="text-paper">YouTube</strong>.
        Meta и TikTok — позже.
      </p>

      {publishPlatforms && (
        <p className="text-[11px] text-ink-45 mb-3 font-mono">
          Платформы: publication → {publishPlatforms.publication.join(", ") || "—"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-[#3a3550] px-3 py-2 text-[13px] text-paper bg-transparent cursor-pointer hover:border-[#7c3aed]/60"
          onClick={connectYoutube}
        >
          Подключить YouTube
          {oauth?.youtube ? <AdminBadge tone="green">подключён</AdminBadge> : <AdminBadge tone="amber">нет OAuth</AdminBadge>}
        </button>

        <button
          type="button"
          disabled
          title="Скоро"
          className="inline-flex items-center gap-2 rounded-md border border-[#2f2b45] px-3 py-2 text-[13px] text-ink-45 opacity-50 cursor-not-allowed"
        >
          Meta — скоро
        </button>
        <button
          type="button"
          disabled
          title="Скоро"
          className="inline-flex items-center gap-2 rounded-md border border-[#2f2b45] px-3 py-2 text-[13px] text-ink-45 opacity-50 cursor-not-allowed"
        >
          TikTok — скоро
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4 text-[13px] text-ink-70">
        <label className="flex flex-col gap-1">
          <span>Лимит загрузок YouTube / сутки</span>
          <input
            type="number"
            min={1}
            max={50}
            className="field max-w-[120px]"
            value={settings?.youtubeDailyUploadCap ?? 5}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1) setSettings((s) => (s ? { ...s, youtubeDailyUploadCap: n } : s));
            }}
            onBlur={() => {
              if (settings?.youtubeDailyUploadCap) {
                patchSettings({ youtubeDailyUploadCap: settings.youtubeDailyUploadCap });
              }
            }}
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={settings?.publishYoutube !== false}
            onChange={(e) => patchSettings({ publishYoutube: e.target.checked })}
          />
          Автопубликация на YouTube после модерации
        </label>
      </div>

      {!oauth?.youtube && (
        <p className="text-[12px] text-amber-200/90 mb-4">
          Подключите YouTube OAuth в Google Cloud Console. Нужны scope upload + readonly и redirect на API callback.
        </p>
      )}

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
                    Опубликовать на YouTube
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

      <p className="text-[13px] font-semibold text-paper mb-2">YouTube ({ytPosts.length})</p>
      <ul className="space-y-1 max-h-48 overflow-auto">
        {ytPosts.length === 0 ? (
          <li className="text-[12px] text-ink-45">Пока нет публикаций</li>
        ) : (
          ytPosts.map((p) => (
            <li key={p.id} className="text-[11px] text-ink-45 flex gap-2 flex-wrap">
              <span className="text-paper">{p.status}</span>
              {p.viewsCount != null && <span>{p.viewsCount} просм.</span>}
              {p.error && <span className="text-amber">{p.error.slice(0, 80)}</span>}
              {p.externalUrl && (
                <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-magenta">
                  Shorts
                </a>
              )}
            </li>
          ))
        )}
      </ul>
    </AdminPanel>
  );
}
