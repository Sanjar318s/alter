"use client";

import { ArrowLeft, Globe } from "lucide-react";
import { ChannelListItem } from "@/components/messages/ChannelListItem";
import {
  filterChannels,
  getRegionChannels,
  getTopicChannels,
  type ChannelChip,
  type CommunityChannel,
} from "@/lib/communityChannels";

export function ChannelSidebar({
  query,
  chip,
  activeId,
  listMode,
  onListModeChange,
  onSelect,
  channels: incoming,
}: {
  query: string;
  chip: ChannelChip;
  activeId: string;
  listMode: "topics" | "regions";
  onListModeChange: (mode: "topics" | "regions") => void;
  onSelect: (channel: CommunityChannel) => void;
  channels?: CommunityChannel[];
}) {
  const catalog = listMode === "topics" ? getTopicChannels() : getRegionChannels();
  const source = incoming && incoming.length > 0 ? incoming : catalog;
  const channels = filterChannels(source, { query, chip });

  return (
    <div className="flex flex-col flex-1 min-h-0 basis-0 overflow-hidden">
      <div className="shrink-0 px-3 py-2.5 border-b border-[#1f1c2e] bg-[#0d0d12]">
        {listMode === "topics" ? (
          <button
            type="button"
            onClick={() => onListModeChange("regions")}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-[10px] border border-[#2a2640] bg-[#12101a] text-[12px] text-paper hover:border-magenta/40 hover:bg-[#151320] transition-colors"
          >
            <Globe size={14} className="text-ink-70" />
            Регионы
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onListModeChange("topics")}
              className="flex items-center gap-1.5 text-[12px] text-ink-45 bg-transparent border-0 hover:text-paper"
            >
              <ArrowLeft size={14} />
              Назад к каналам
            </button>
            <div className="font-mono text-[10px] uppercase text-ink-45 mt-2">Регионы</div>
          </>
        )}
      </div>

      <div className="pane-scroll">
        {channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-ink-45">Ничего не найдено</div>
        ) : (
          channels.map((ch) => (
            <ChannelListItem
              key={ch.id}
              channel={ch}
              active={activeId === ch.id}
              onSelect={() => onSelect(ch)}
            />
          ))
        )}
      </div>
    </div>
  );
}
