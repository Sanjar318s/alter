"use client";

import { X, Files } from "lucide-react";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";

export function ChannelSheet({
  kind,
  title,
  members,
  pinnedMessages,
  media,
  files,
  activity,
  onClose,
  onOpenMember,
  onScrollToMessage,
  onOpenMedia,
}: {
  kind: "members" | "pinned" | "media" | "files" | "activity";
  title: string;
  members?: { id: string; username: string; avatarUrl?: string }[];
  pinnedMessages?: { id: string; text?: string; sender: string }[];
  media?: string[];
  files?: { id: string; name: string; url?: string }[];
  activity?: { messagesCount: number; membersCount: number; lastActive?: string };
  onClose: () => void;
  onOpenMember: (username: string) => void;
  onScrollToMessage: (id: string) => void;
  onOpenMedia: (items: string[], index: number) => void;
}) {
  const headings = {
    members: "Участники",
    pinned: "Закреплённые",
    media: "Медиа",
    files: "Файлы",
    activity: "Активность",
  };

  return (
    <div className="fixed inset-0 z-[85] bg-ink/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-stage border border-line w-full sm:max-w-[440px] max-h-[85vh] overflow-hidden rounded-t-[12px] sm:rounded-[12px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div>
            <div className="font-display font-bold text-[16px]">{headings[kind]}</div>
            <div className="text-[11px] text-ink-45 truncate">{title}</div>
          </div>
          <button type="button" className="bg-transparent border-0 text-ink-45 hover:text-paper" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="pane-scroll p-3">
          {kind === "members" &&
            (members?.length ? (
              members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpenMember(m.username)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-[8px] bg-transparent border-0 hover:bg-ink/50 text-left"
                >
                  <Frame className="w-9 h-9 overflow-hidden rounded-full">
                    <SmartImage src={m.avatarUrl} alt={m.username} fallback={m.username} />
                  </Frame>
                  <span className="text-[13px] text-paper">@{m.username}</span>
                </button>
              ))
            ) : (
              <p className="text-[13px] text-ink-45 py-6 text-center">Нет участников</p>
            ))}

          {kind === "pinned" &&
            (pinnedMessages?.length ? (
              pinnedMessages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onScrollToMessage(m.id)}
                  className="w-full text-left px-2 py-2.5 rounded-[8px] bg-transparent border-0 hover:bg-ink/50 mb-1"
                >
                  <div className="text-[11px] text-magenta">@{m.sender}</div>
                  <div className="text-[13px] text-paper truncate">{m.text || "Медиа"}</div>
                </button>
              ))
            ) : (
              <p className="text-[13px] text-ink-45 py-6 text-center">Нет закреплённых сообщений</p>
            ))}

          {kind === "media" && (
            <div className="grid grid-cols-3 gap-1.5">
              {!media?.length && <p className="col-span-3 text-[13px] text-ink-45 py-6 text-center">Нет медиа</p>}
              {media?.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  className="aspect-square border-0 p-0 overflow-hidden rounded-[6px]"
                  onClick={() => onOpenMedia(media, i)}
                >
                  <SmartImage src={src} alt="" fallback="media" />
                </button>
              ))}
            </div>
          )}

          {kind === "files" &&
            (files?.length ? (
              files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-2.5 rounded-[8px] bg-transparent border-0 hover:bg-ink/50 text-left"
                  onClick={() => f.url && window.open(f.url, "_blank")}
                >
                  <Files size={16} className="text-magenta shrink-0" />
                  <span className="text-[13px] truncate">{f.name}</span>
                </button>
              ))
            ) : (
              <p className="text-[13px] text-ink-45 py-6 text-center">Нет файлов</p>
            ))}

          {kind === "activity" && activity && (
            <div className="space-y-3 text-[13px] px-1">
              <p className="text-paper">
                Всего сообщений: <span className="font-mono">{activity.messagesCount}</span>
              </p>
              <p className="text-paper">
                Участников: <span className="font-mono">{activity.membersCount}</span>
              </p>
              {activity.lastActive && <p className="text-ink-45">Последнее сообщение: {activity.lastActive}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
