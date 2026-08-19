"use client";

import { CheckCheck, Forward, Heart, MoreHorizontal, Reply } from "lucide-react";
import { Frame } from "@/components/Frame";
import { ChatOrderCard } from "@/components/messages/ChatOrderCard";
import { WaveformPlayer } from "@/components/messages/WaveformPlayer";
import { SmartImage } from "@/components/media/SmartImage";
import { StaffBadge } from "@/components/staff/StaffBadge";
import { cn } from "@/lib/cn";
import { formatBlacklistCardLine } from "@/lib/blacklistCardFormat";
import { Play } from "lucide-react";

export type ChatMsg = {
  id: string;
  own: boolean;
  sender: string;
  senderId?: string;
  senderAvatar?: string;
  text?: string;
  type: "text" | "image" | "voice" | "video" | "file" | "sticker" | "order";
  time: string;
  duration?: number;
  mediaUrl?: string;
  mediaUrls?: string[];
  sticker?: string;
  replyTo?: { id: string; sender: string; preview: string };
  failed?: boolean;
  senderRole?: string;
  senderBadgeHidden?: boolean;
  reactions?: Record<string, string[]>;
  replyCount?: number;
  createdAt?: string;
  pinned?: boolean;
  favorited?: boolean;
};

function isRealSrc(src?: string) {
  if (!src) return false;
  return /^(blob:|data:|https?:|\/)/.test(src);
}

function ChatPhoto({ src, onOpen }: { src: string; onOpen: () => void }) {
  return (
    <button type="button" className="block w-full border-0 p-0 cursor-pointer overflow-hidden rounded-[8px]" onClick={onOpen}>
      <SmartImage src={src} alt="" fallback="photo" className="w-full aspect-square object-cover" />
    </button>
  );
}

export function ChatMessageRow({
  message: m,
  hit,
  threadQ,
  highlight,
  activeHit,
  onMenuOpen,
  onReply,
  onReact,
  onForward,
  onOpenMedia,
  onScrollToReply,
}: {
  message: ChatMsg;
  hit?: boolean;
  threadQ?: string;
  highlight?: (text: string, q: string) => import("react").ReactNode;
  activeHit?: boolean;
  onMenuOpen: (message: ChatMsg, anchor: DOMRect) => void;
  onReply: (m: ChatMsg) => void;
  onReact: (id: string, emoji: string) => void;
  onForward: (m: ChatMsg) => void;
  onOpenMedia: (items: string[], index: number) => void;
  onScrollToReply: (id: string) => void;
}) {
  const photos = m.mediaUrls?.length ? m.mediaUrls : m.mediaUrl ? [m.mediaUrl] : [];
  const isModCard = m.type === "text" && String(m.text || "").startsWith("🚫 ALTER BLACKLIST CARD");
  const reactionEntries = Object.entries(m.reactions || {}).filter(([, users]) => users.length > 0);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onMenuOpen(m, e.currentTarget.getBoundingClientRect());
  }

  return (
    <div
      id={`msg-${m.id}`}
      className={cn("flex group gap-2.5", m.own ? "flex-row-reverse" : "flex-row")}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenuOpen(m, new DOMRect(e.clientX, e.clientY, 0, 0));
      }}
    >
      <Frame className="w-9 h-9 shrink-0 overflow-hidden rounded-full">
        <SmartImage src={m.senderAvatar} alt={m.sender} fallback={m.sender} />
      </Frame>

      <div className={cn("flex min-w-0 max-w-[min(100%,520px)] flex-col gap-1.5", m.own ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative w-full min-w-0",
            isModCard ? "max-w-[min(100%,320px)]" : "max-w-[min(100%,480px)]"
          )}
        >
          {!m.own && (
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <span className="text-[12px] font-medium text-magenta">@{m.sender}</span>
              <StaffBadge role={m.senderRole} hidden={m.senderBadgeHidden} />
              {m.pinned && (
                <span className="text-[10px] text-ink-45 font-mono uppercase tracking-wide">📌</span>
              )}
            </div>
          )}
          {m.own && (
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5 justify-end">
              <span className="text-[12px] font-medium text-[#7eb8ff]">@{m.sender || "вы"}</span>
              {m.pinned && (
                <span className="text-[10px] text-ink-45 font-mono uppercase tracking-wide">📌</span>
              )}
            </div>
          )}

          <div
            className={cn(
              "relative overflow-hidden",
              isModCard
                ? "p-0 bg-transparent"
                : cn(
                    "rounded-[12px] px-3.5 py-2.5",
                    m.own
                      ? "bg-[#1a2438] border border-[#4a7fd4]/45"
                      : "bg-[#1a1824] border border-[#2a2640]",
                    !m.own && "border-l-[3px] border-l-magenta/80",
                    m.type === "voice" && "w-[min(100%,280px)]",
                    activeHit && "ring-1 ring-magenta"
                  )
            )}
          >
            {m.replyTo && (
              <button
                type="button"
                onClick={() => onScrollToReply(m.replyTo!.id)}
                className="w-full text-left mb-2 pl-2.5 border-l-2 border-magenta/70 bg-black/25 px-2.5 py-1.5 rounded-[8px]"
              >
                <div className="text-[11px] text-magenta truncate">@{m.replyTo.sender}</div>
                <div className="text-[11px] text-ink-45 truncate">{m.replyTo.preview}</div>
              </button>
            )}

            {m.type === "text" && (
              <div className="text-[13px] leading-relaxed break-words text-paper/95">
                {String(m.text || "").startsWith("🚫 ALTER BLACKLIST CARD") ? (
                  <BlacklistCard text={String(m.text || "")} />
                ) : hit && m.text && highlight
                  ? highlight(m.text, threadQ || "")
                  : m.text}
              </div>
            )}
            {m.type === "order" && <ChatOrderCard text={m.text} />}
            {m.type === "sticker" && (
              <div className="text-[56px] leading-none py-1" title={m.text}>
                {m.sticker || m.text}
              </div>
            )}
            {m.type === "image" && (
              <div className={cn("gap-1.5", photos.length > 1 ? "grid grid-cols-2 max-w-[280px]" : "max-w-[280px]")}>
                {photos.map((src, i) => (
                  <ChatPhoto key={src + i} src={src} onOpen={() => onOpenMedia(photos, i)} />
                ))}
              </div>
            )}
            {m.type === "image" && m.text && (
              <div className="text-[13px] break-words mt-2">{hit && highlight ? highlight(m.text, threadQ || "") : m.text}</div>
            )}
            {m.type === "voice" && <WaveformPlayer src={m.mediaUrl} duration={m.duration} />}
            {m.type === "video" &&
              (isRealSrc(m.mediaUrl) ? (
                <video src={m.mediaUrl} controls className="w-full max-w-[280px] rounded-[8px] max-h-[220px]" />
              ) : (
                <Frame className="w-full max-w-[220px] aspect-video overflow-hidden relative rounded-[8px]">
                  <SmartImage src={m.mediaUrl} alt="" fallback="video" />
                  <div className="absolute inset-0 flex items-center justify-center z-[1]">
                    <Play size={28} />
                  </div>
                </Frame>
              ))}

            {!isModCard && (
              <div className={cn("flex flex-wrap items-center gap-1.5 mt-2", m.own ? "justify-end" : "justify-start")}>
                {reactionEntries.map(([emoji, users]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(m.id, emoji)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#12101a] border border-[#2a2640] text-[11px] hover:border-magenta/50 transition-colors"
                  >
                    <span>{emoji}</span>
                    <span className="font-mono text-ink-70 tabular-nums">{users.length}</span>
                  </button>
                ))}
                <span className="font-mono text-[10px] text-ink-45 ml-auto flex items-center gap-1">
                  {m.time}
                  {m.favorited && <span className="text-amber">★</span>}
                  {m.own && <CheckCheck size={13} className="text-[#5b9cf5]" strokeWidth={2.25} />}
                </span>
              </div>
            )}
          </div>
        </div>

        {!isModCard && (
          <div
            className={cn(
              "flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
              m.own ? "flex-row-reverse" : "flex-row"
            )}
          >
            <button
              type="button"
              aria-label="Ответить"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-[#12101a]/90 border border-[#2a2640] text-[11px] text-ink-45 hover:text-magenta hover:border-magenta/40"
              onClick={() => onReply(m)}
            >
              <Reply size={12} />
              <span className="hidden sm:inline">Ответить</span>
            </button>
            <button
              type="button"
              aria-label="Реакция"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-[#12101a]/90 border border-[#2a2640] text-[11px] text-ink-45 hover:text-magenta hover:border-magenta/40"
              onClick={() => onReact(m.id, "❤️")}
            >
              <Heart size={12} />
            </button>
            <button
              type="button"
              aria-label="Переслать"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-[#12101a]/90 border border-[#2a2640] text-[11px] text-ink-45 hover:text-paper hover:border-[#3a3550]"
              onClick={() => onForward(m)}
            >
              <Forward size={12} />
            </button>
            <button
              type="button"
              aria-label="Меню"
              className="w-7 h-7 shrink-0 rounded-full bg-[#12101a]/90 border border-[#2a2640] text-ink-45 hover:text-paper hover:border-[#3a3550] flex items-center justify-center"
              onClick={openMenu}
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        )}

        {(m.replyCount || 0) > 0 && (
          <button
            type="button"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] bg-[#151320] border border-[#2a2640] text-[11px] text-magenta hover:border-magenta/40 transition-colors"
            onClick={() => onScrollToReply(m.id)}
          >
            <Frame className="w-5 h-5 overflow-hidden rounded-full">
              <SmartImage src={m.senderAvatar} alt="" fallback={m.sender} />
            </Frame>
            <span>
              {m.replyCount} {m.replyCount === 1 ? "ответ" : m.replyCount! < 5 ? "ответа" : "ответов"} ›
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function BlacklistCard({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  const formatted = lines.slice(1).map((line) => formatBlacklistCardLine(line));
  const lineMap = new Map(
    formatted
      .map((line) => {
        const i = line.indexOf(":");
        if (i === -1) return null;
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()] as const;
      })
      .filter(Boolean) as Array<readonly [string, string]>
  );
  const actionType = (lineMap.get("Тип") || "").toLowerCase();
  const title = actionType.includes("чёрный список")
    ? "В чёрном списке"
    : actionType.includes("авто")
      ? "Автоблокировка"
      : "Блокировка";
  const infoRows = [
    ["Пользователь", lineMap.get("Пользователь")],
    ["Причина", lineMap.get("Причина")],
    ["Кем", lineMap.get("Кем")],
    ["Когда", lineMap.get("Когда")],
  ].filter(([, value]) => value && value !== "—") as Array<[string, string]>;

  return (
    <div className="border border-magenta/40 bg-gradient-to-br from-[#2a1525]/95 via-[#1e1524] to-[#14141c] p-3 rounded-[10px] w-full">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-45 mb-2">ALTER · Модерация</div>
      <h4 className="text-[15px] font-semibold leading-snug mb-2 text-paper">{title}</h4>
      <dl className="space-y-2">
        {infoRows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-ink-45 mb-0.5">{label}</dt>
            <dd className="text-[12px] text-paper/95 m-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
