"use client";

import { X, Bell, Users, Pin, ImageIcon, Files } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";

const CHANNEL_BLURBS: Record<string, string> = {
  "ch-obshalka": "Обсуждение косплея, фотографии, мероприятия и общение сообщества.",
  "ch-events": "Анонсы фестивалей, даты и организационная информация.",
  "ch-rules": "Правила сообщества ALTER — прочитайте перед публикацией.",
  "ch-blacklist": "Карточки блокировок и предупреждений модерации.",
};

export function ChannelInfoPanel({
  icon,
  title,
  channelId,
  membersCount,
  description,
  notificationsOn,
  pinnedCount,
  mediaCount,
  filesCount,
  onlineEstimate,
  createdAt,
  onToggleNotifications,
  onOpenSheet,
  onClose,
}: {
  icon: string;
  title: string;
  channelId?: string;
  membersCount: number;
  description?: string;
  notificationsOn: boolean;
  pinnedCount: number;
  mediaCount: number;
  filesCount: number;
  onlineEstimate: number;
  createdAt?: string;
  onToggleNotifications: () => void;
  onOpenSheet: (sheet: "members" | "pinned" | "media" | "files" | "activity") => void;
  onClose: () => void;
}) {
  const displayTitle = title.startsWith("#") ? title : `# ${title}`;
  const blurb =
    description ||
    (channelId ? CHANNEL_BLURBS[channelId] : undefined) ||
    "Канал сообщества ALTER.";

  const rows = [
    { id: "members" as const, icon: Users, label: "Участники", value: String(membersCount) },
    { id: "pinned" as const, icon: Pin, label: "Закреплено", value: String(pinnedCount) },
    { id: "media" as const, icon: ImageIcon, label: "Медиа", value: String(mediaCount) },
    { id: "files" as const, icon: Files, label: "Файлы", value: String(filesCount) },
  ];

  return (
    <div className="pane-scroll p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-45">Информация</span>
        <button type="button" className="bg-transparent border-0 text-ink-45 hover:text-paper" onClick={onClose} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="text-center mb-5">
        <span className="inline-flex w-16 h-16 items-center justify-center text-3xl bg-[#12101a] border border-line rounded-[14px] mb-3">
          {icon}
        </span>
        <h2 className="font-display font-extrabold text-[18px] text-paper">{displayTitle}</h2>
        <p className="text-[12px] text-ink-45 mt-1">{membersCount} участников</p>
        <p className="text-[13px] text-ink-70 leading-relaxed mt-3 px-1">{blurb}</p>
      </div>

      <div className="border-t border-b border-line py-1 divide-y divide-line/80">
        <label className="flex items-center justify-between px-1 py-2.5 cursor-pointer">
          <span className="flex items-center gap-2 text-[13px] text-ink-70">
            <Bell size={14} /> Уведомления
          </span>
          <Checkbox checked={notificationsOn} onChange={onToggleNotifications} />
        </label>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpenSheet(row.id)}
            className="w-full flex items-center justify-between px-1 py-2.5 bg-transparent border-0 text-left hover:bg-stage-elevated/40 rounded-[6px] transition-colors"
          >
            <span className="flex items-center gap-2 text-[13px] text-ink-70">
              <row.icon size={14} /> {row.label}
            </span>
            <span className="text-[12px] text-ink-45 font-mono tabular-nums">{row.value} ›</span>
          </button>
        ))}
      </div>

      <div className="mt-5 px-1">
        <div className="text-[11px] font-mono uppercase tracking-wide text-ink-45 mb-2">Последняя активность</div>
        <button type="button" onClick={() => onOpenSheet("activity")} className="w-full text-left bg-transparent border-0 p-0">
          <p className="text-[13px] text-paper flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
            Сейчас — ~{onlineEstimate} участников онлайн
          </p>
          {createdAt && (
            <p className="text-[12px] text-ink-45 mt-2">
              Создан: {new Date(createdAt).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </button>
      </div>
    </div>
  );
}
