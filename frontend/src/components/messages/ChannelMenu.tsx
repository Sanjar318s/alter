"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Bell,
  ChevronRight,
  DoorOpen,
  Files,
  ImageIcon,
  Link2,
  Pin,
  Search,
  Settings,
  Shield,
  Users,
  UserCog,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type ChannelMenuAction =
  | "notifications"
  | "search"
  | "pinned"
  | "members"
  | "media"
  | "invite"
  | "activity"
  | "files"
  | "settings"
  | "moderation"
  | "manage-members"
  | "audit-log"
  | "leave";

type RowProps = {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
};

function MenuRow({ icon, label, hint, danger, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
        danger ? "text-magenta hover:bg-magenta/10" : "text-paper hover:bg-stage-elevated/80"
      )}
    >
      <span className="w-5 shrink-0 flex items-center justify-center text-ink-70">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px]">{label}</span>
        {hint && <span className="block text-[11px] text-ink-45 truncate">{hint}</span>}
      </span>
      <ChevronRight size={14} className="shrink-0 text-ink-45" />
    </button>
  );
}

export function ChannelMenu({
  open,
  anchor,
  title,
  membersCount,
  notificationsOn,
  isModerator,
  onClose,
  onAction,
}: {
  open: boolean;
  anchor: DOMRect | null;
  title: string;
  membersCount: number;
  notificationsOn: boolean;
  isModerator: boolean;
  onClose: () => void;
  onAction: (action: ChannelMenuAction) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) {
      setPos(null);
      return;
    }
    const panel = panelRef.current.getBoundingClientRect();
    const pad = 8;
    let top = anchor.bottom + 6;
    let left = anchor.right - panel.width;
    if (left < pad) left = pad;
    if (left + panel.width > window.innerWidth - pad) left = window.innerWidth - panel.width - pad;
    if (top + panel.height > window.innerHeight - pad) top = anchor.top - panel.height - 6;
    setPos({ top, left });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const pick = (action: ChannelMenuAction) => {
    onAction(action);
    onClose();
  };

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "z-[80] w-[min(100vw-24px,300px)] rounded-[12px] border border-line bg-[#12101a]/98 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.45)] overflow-hidden msg-menu-enter",
        mobile ? "fixed left-3 right-3 bottom-4 w-auto max-h-[75vh] overflow-y-auto" : "fixed"
      )}
      style={mobile ? undefined : pos ? { top: pos.top, left: pos.left } : { top: anchor?.bottom ?? 0, left: anchor?.left ?? 0, visibility: "hidden" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-3 border-b border-line/80">
        <div className="font-medium text-[14px] text-paper truncate">{title.startsWith("#") ? title : `# ${title}`}</div>
        <div className="text-[11px] text-ink-45 mt-0.5">{membersCount} участников</div>
      </div>

      <div className="py-1">
        <div className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-wide text-ink-45">Быстрые действия</div>
        <MenuRow
          icon={<Bell size={15} />}
          label="Уведомления"
          hint={notificationsOn ? "Включены" : "Выключены"}
          onClick={() => pick("notifications")}
        />
        <MenuRow icon={<Search size={15} />} label="Поиск в канале" onClick={() => pick("search")} />
        <MenuRow icon={<Pin size={15} />} label="Закреплённые сообщения" onClick={() => pick("pinned")} />
        <MenuRow icon={<ImageIcon size={15} />} label="Медиа и файлы" onClick={() => pick("media")} />
      </div>

      <div className="h-px bg-line/80 mx-2" />

      <div className="py-1">
        <div className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-wide text-ink-45">Канал</div>
        <MenuRow icon={<Users size={15} />} label="Участники" hint={`${membersCount} участников`} onClick={() => pick("members")} />
        <MenuRow icon={<Link2 size={15} />} label="Пригласить по ссылке" onClick={() => pick("invite")} />
        <MenuRow icon={<Activity size={15} />} label="Активность канала" onClick={() => pick("activity")} />
        <MenuRow icon={<Files size={15} />} label="Файлы" onClick={() => pick("files")} />
      </div>

      {isModerator && (
        <>
          <div className="h-px bg-line/80 mx-2" />
          <div className="py-1">
            <div className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-wide text-ink-45">Управление</div>
            <MenuRow icon={<Settings size={15} />} label="Настройки канала" onClick={() => pick("settings")} />
            <MenuRow icon={<Shield size={15} />} label="Модерация" onClick={() => pick("moderation")} />
            <MenuRow icon={<UserCog size={15} />} label="Управление участниками" onClick={() => pick("manage-members")} />
            <MenuRow icon={<ScrollText size={15} />} label="Журнал действий" onClick={() => pick("audit-log")} />
          </div>
        </>
      )}

      <div className="h-px bg-line/80 mx-2" />
      <div className="py-1 pb-2">
        <MenuRow icon={<DoorOpen size={15} />} label="Покинуть канал" danger onClick={() => pick("leave")} />
      </div>
    </div>
  );

  return createPortal(
    <>
      {mobile && <div className="fixed inset-0 z-[75] bg-ink/50 md:hidden" aria-hidden onClick={onClose} />}
      {panel}
    </>,
    document.body
  );
}
