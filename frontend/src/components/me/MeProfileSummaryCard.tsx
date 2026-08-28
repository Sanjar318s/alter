"use client";

import { Camera, Heart, Star } from "lucide-react";
import { SmartImage } from "@/components/media/SmartImage";
import type { PlatformRole } from "@/lib/AuthContext";

type MeProfileSummaryCardProps = {
  nick: string;
  bio: string;
  avatarUrl: string | null;
  role: PlatformRole | null | undefined;
  primarySocial?: { platform: string; url: string } | null;
  stats: { builds: number; orders: number; rating: string; likes: number };
  onAvatarChange: (file: File) => void;
};

const ROLE_LABELS: Record<string, string> = {
  client: "Клиент",
  blogger: "Блогер",
  seller: "Продавец",
};

function formatLikes(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function MeProfileSummaryCard({
  nick,
  bio,
  avatarUrl,
  role,
  primarySocial,
  stats,
  onAvatarChange,
}: MeProfileSummaryCardProps) {
  const roleLabel = role ? ROLE_LABELS[role] ?? role : "Не выбрана";

  return (
    <section className="me-profile-card mb-6">
      <div className="me-profile-card-inner">
        <div className="me-profile-avatar">
          <SmartImage src={avatarUrl} alt={nick} fallback={nick} className="w-full h-full object-cover" />
          <label className="me-profile-avatar-overlay">
            <Camera size={18} strokeWidth={1.75} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAvatarChange(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display font-bold text-[18px] text-paper">{nick}</h2>
            <span className="me-role-badge">{roleLabel}</span>
          </div>
          {bio ? (
            <p className="text-[13px] text-ink-70 mt-2 leading-relaxed line-clamp-3">{bio}</p>
          ) : (
            <p className="text-[13px] text-ink-45 mt-2 italic">Добавьте описание в блоке ниже</p>
          )}
          {primarySocial?.url ? (
            <a
              href={primarySocial.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[12px] text-magenta mt-2 no-underline hover:underline"
            >
              {primarySocial.url.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          <div className="me-profile-stats">
            <div className="me-profile-stat">
              <div className="font-mono text-[18px] text-paper">{stats.builds}</div>
              <div className="text-[11px] text-ink-45">Работ</div>
            </div>
            <div className="me-profile-stat">
              <div className="font-mono text-[18px] text-paper">{stats.orders}</div>
              <div className="text-[11px] text-ink-45">Заказов</div>
            </div>
            <div className="me-profile-stat">
              <div className="font-mono text-[18px] text-paper flex items-center justify-center gap-1">
                <Star size={14} className="text-amber shrink-0" strokeWidth={1.75} />
                {stats.rating}
              </div>
              <div className="text-[11px] text-ink-45">Рейтинг</div>
            </div>
            <div className="me-profile-stat">
              <div className="font-mono text-[18px] text-paper flex items-center justify-center gap-1">
                <Heart size={14} className="text-magenta shrink-0" strokeWidth={1.75} />
                {formatLikes(stats.likes)}
              </div>
              <div className="text-[11px] text-ink-45">Лайков</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
