"use client";

import { Lock, Pin } from "lucide-react";
import { CountBadge } from "@/components/ui/CountBadge";
import type { CommunityChannel } from "@/lib/communityChannels";
import { cn } from "@/lib/cn";

export function ChannelListItem({
  channel,
  active,
  onSelect,
}: {
  channel: CommunityChannel;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-[#1f1c2e]/80",
        active
          ? "bg-[#1a1524] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-magenta"
          : "hover:bg-[#151320]/80"
      )}
    >
      <span className="w-10 h-10 shrink-0 flex items-center justify-center text-lg bg-[#12101a] border border-[#2a2640] rounded-[10px]">
        {channel.icon}
      </span>
      <span className="flex-1 min-w-0 pl-0.5">
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] font-medium text-paper truncate">{channel.title}</span>
          {channel.pinned && <Pin size={11} className="shrink-0 text-ink-45" />}
        </span>
        <span className="block text-[12px] truncate mt-0.5 leading-snug">
          {channel.preview.author ? (
            <>
              <span className="text-magenta">{channel.preview.author}:</span>{" "}
              <span
                className={
                  channel.preview.accent
                    ? "text-magenta font-semibold uppercase tracking-wide"
                    : "text-ink-45"
                }
              >
                {channel.preview.text}
              </span>
            </>
          ) : (
            <span className="text-ink-45">{channel.preview.text || "Пока нет сообщений"}</span>
          )}
        </span>
      </span>
      <span className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
        <span className="flex items-center gap-1">
          {(channel.locked || channel.writeMode === "owner_only" || channel.writeMode === "channel_admins") && (
            <Lock size={10} className="text-ink-45" />
          )}
          <span className="font-mono text-[10px] text-ink-45 whitespace-nowrap">{channel.time}</span>
        </span>
        {(channel.unread ?? 0) > 0 && <CountBadge count={channel.unread!} dot />}
      </span>
    </button>
  );
}
