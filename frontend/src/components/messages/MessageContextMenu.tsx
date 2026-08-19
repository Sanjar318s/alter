"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Copy,
  Flag,
  Forward,
  Link2,
  MessageSquareReply,
  Pencil,
  Pin,
  Shield,
  Star,
  Trash2,
  UserX,
  EyeOff,
  History,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/cn";

import type { ReactNode } from "react";

export type MessageMenuAction =
  | "reply"
  | "forward"
  | "copy-link"
  | "copy-text"
  | "favorite"
  | "thread-sub"
  | "edit"
  | "delete"
  | "pin"
  | "report"
  | "hide-user"
  | "block"
  | "mod-profile"
  | "mod-report"
  | "mod-block"
  | "mod-restrict"
  | "mod-history";

type Item = {
  id: MessageMenuAction;
  label: string;
  icon: ReactNode;
  danger?: boolean;
};

function MenuButton({ item, onPick }: { item: Item; onPick: (id: MessageMenuAction) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.id)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors",
        item.danger
          ? "text-magenta hover:bg-magenta/10"
          : "text-paper hover:bg-stage-elevated/80"
      )}
    >
      <span className="w-5 shrink-0 flex items-center justify-center text-ink-70">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}

export function MessageContextMenu({
  open,
  anchor,
  own,
  isModerator,
  canBlockTarget,
  favorited,
  threadSubscribed,
  pinned,
  canEdit,
  onClose,
  onAction,
}: {
  open: boolean;
  anchor: DOMRect | null;
  own: boolean;
  isModerator: boolean;
  canBlockTarget: boolean;
  favorited: boolean;
  threadSubscribed: boolean;
  pinned: boolean;
  canEdit: boolean;
  onClose: () => void;
  onAction: (action: MessageMenuAction) => void;
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
    let left = anchor.left;
    if (left + panel.width > window.innerWidth - pad) {
      left = window.innerWidth - panel.width - pad;
    }
    if (left < pad) left = pad;
    if (top + panel.height > window.innerHeight - pad) {
      top = anchor.top - panel.height - 6;
    }
    setPos({ top, left });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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

  const common: Item[] = [
    { id: "reply", label: "Ответить", icon: <MessageSquareReply size={15} /> },
    { id: "forward", label: "Переслать", icon: <Forward size={15} /> },
    { id: "copy-link", label: "Копировать ссылку", icon: <Link2 size={15} /> },
    { id: "copy-text", label: "Скопировать текст", icon: <Copy size={15} /> },
    {
      id: "favorite",
      label: favorited ? "Убрать из избранного" : "В избранное",
      icon: <Star size={15} className={favorited ? "text-amber fill-amber" : undefined} />,
    },
    {
      id: "thread-sub",
      label: threadSubscribed ? "Отписаться от ответов" : "Подписаться на ответы",
      icon: <Bell size={15} className={threadSubscribed ? "text-magenta" : undefined} />,
    },
  ];

  const ownExtra: Item[] = [
    ...(canEdit ? [{ id: "edit" as const, label: "Редактировать", icon: <Pencil size={15} /> }] : []),
    {
      id: "pin",
      label: pinned ? "Открепить" : "Закрепить",
      icon: <Pin size={15} className={pinned ? "text-magenta" : undefined} />,
    },
    { id: "delete", label: "Удалить", icon: <Trash2 size={15} />, danger: true },
  ];

  const otherExtra: Item[] = [
    { id: "report", label: "Пожаловаться", icon: <Flag size={15} /> },
    { id: "hide-user", label: "Скрыть сообщения пользователя", icon: <EyeOff size={15} /> },
    ...(canBlockTarget
      ? [{ id: "block" as const, label: "Заблокировать пользователя", icon: <UserX size={15} />, danger: true }]
      : []),
  ];

  const modExtra: Item[] = isModerator
    ? [
        { id: "mod-profile", label: "Открыть профиль", icon: <Shield size={15} /> },
        { id: "mod-report", label: "Создать жалобу", icon: <Flag size={15} /> },
        { id: "mod-restrict", label: "Ограничить пользователя", icon: <Lock size={15} /> },
        { id: "mod-history", label: "История модерации", icon: <History size={15} /> },
        { id: "mod-block", label: "Заблокировать (модерация)", icon: <UserX size={15} />, danger: true },
      ]
    : [];

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "z-[80] w-[min(100vw-24px,280px)] rounded-[12px] border border-line bg-[#12101a]/98 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.45)] overflow-hidden msg-menu-enter",
        mobile ? "fixed left-3 right-3 bottom-4 w-auto max-h-[70vh] overflow-y-auto" : "fixed"
      )}
      style={
        mobile
          ? undefined
          : pos
            ? { top: pos.top, left: pos.left }
            : { top: anchor?.bottom ?? 0, left: anchor?.left ?? 0, visibility: "hidden" as const }
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        {common.map((item) => (
          <MenuButton key={item.id} item={item} onPick={onAction} />
        ))}
      </div>

      {(own ? ownExtra : otherExtra).length > 0 && (
        <>
          <div className="h-px bg-line/80 mx-2" />
          <div className="py-1">
            {(own ? ownExtra : otherExtra).map((item) => (
              <MenuButton key={item.id} item={item} onPick={onAction} />
            ))}
          </div>
        </>
      )}

      {modExtra.length > 0 && (
        <>
          <div className="h-px bg-line/80 mx-2" />
          <div className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-45">Модерация</div>
          <div className="py-1 pb-2">
            {modExtra.map((item) => (
              <MenuButton key={item.id} item={item} onPick={onAction} />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(
    <>
      {mobile && (
        <div
          className="fixed inset-0 z-[75] bg-ink/50 md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}
      {panel}
    </>,
    document.body
  );
}
