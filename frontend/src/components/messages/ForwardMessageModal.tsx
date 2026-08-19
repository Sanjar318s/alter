"use client";

import { useMemo, useState } from "react";
import { Hash, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";
import type { ChatMsg } from "@/components/messages/ChatMessageRow";

export type ForwardTarget = {
  id: string;
  label: string;
  kind: "dm" | "channel";
  avatarUrl?: string;
};

function TargetRow({
  target,
  selected,
  onSelect,
}: {
  target: ForwardTarget;
  selected: boolean;
  onSelect: () => void;
}) {
  const isChannel = target.kind === "channel";
  const label = isChannel
    ? target.label.startsWith("#")
      ? target.label
      : `# ${target.label}`
    : target.label.startsWith("@")
      ? target.label
      : `@${target.label}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 text-left px-3 py-2.5 bg-transparent border-0 transition-colors",
        selected ? "bg-magenta/15 text-paper" : "text-ink-70 hover:bg-stage-elevated/60"
      )}
    >
      {isChannel ? (
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-ink border border-line text-ink-45">
          <Hash size={14} />
        </span>
      ) : (
        <Frame className="w-8 h-8 shrink-0 overflow-hidden rounded-full">
          <SmartImage src={target.avatarUrl} alt={target.label} fallback={target.label} />
        </Frame>
      )}
      <span className="flex-1 min-w-0 truncate text-[13px]">{label}</span>
    </button>
  );
}

function TargetSection({
  title,
  icon,
  empty,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="sticky top-0 z-[1] flex items-center gap-2 px-3 py-2 bg-stage-elevated/95 border-b border-line backdrop-blur-sm">
        <span className="text-ink-45">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-45">{title}</span>
        {count > 0 && <span className="ml-auto font-mono text-[10px] text-ink-45">{count}</span>}
      </div>
      {count > 0 ? children : <p className="px-3 py-4 text-[12px] text-ink-45">{empty}</p>}
    </div>
  );
}

export function ForwardMessageModal({
  message,
  targets,
  onClose,
  onForward,
}: {
  message: ChatMsg;
  targets: ForwardTarget[];
  onClose: () => void;
  onForward: (conversationId: string, label: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const preview = message.text || (message.type === "image" ? "Фото" : message.type);

  const { dms, channels } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? targets.filter((t) => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
      : targets;
    return {
      dms: filtered.filter((t) => t.kind === "dm"),
      channels: filtered.filter((t) => t.kind === "channel"),
    };
  }, [targets, query]);

  return (
    <Modal title="Переслать сообщение" onClose={onClose} wide>
      <p className="text-[13px] text-ink-45 mb-3 line-clamp-3 border border-line rounded-[8px] px-3 py-2 bg-ink/40">
        ↗ от @{message.sender}: {preview}
      </p>

      <input
        className="w-full h-9 mb-3 rounded-[8px] bg-ink border border-line px-3 text-[13px] text-paper placeholder:text-ink-45 focus:outline-none focus:border-magenta/50"
        placeholder="Поиск чата или канала…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="max-h-72 overflow-y-auto border border-line rounded-[8px] divide-y divide-line">
        {targets.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-ink-45">Нет доступных чатов</p>
        ) : dms.length === 0 && channels.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-ink-45">Ничего не найдено</p>
        ) : (
          <>
            <TargetSection title="Личные сообщения" icon={<MessageCircle size={13} />} empty="Нет личных диалогов" count={dms.length}>
              {dms.map((t) => (
                <TargetRow key={t.id} target={t} selected={selected === t.id} onSelect={() => setSelected(t.id)} />
              ))}
            </TargetSection>
            <TargetSection title="Каналы" icon={<Hash size={13} />} empty="Нет каналов" count={channels.length}>
              {channels.map((t) => (
                <TargetRow key={t.id} target={t} selected={selected === t.id} onSelect={() => setSelected(t.id)} />
              ))}
            </TargetSection>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-4 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button
          disabled={!selected || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const t = targets.find((x) => x.id === selected);
              await onForward(selected, t?.label || "");
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          Переслать
        </Button>
      </div>
    </Modal>
  );
}
