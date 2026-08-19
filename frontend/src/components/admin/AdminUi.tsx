"use client";

import type { ReactNode } from "react";
import {
  Clock,
  FolderOpen,
  HelpCircle,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function AdminPanel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-[12px] border border-[#2f2b45] bg-[#1a1828]/95 shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminHelpButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="h-6 w-6 rounded-full border border-[#3a3550] text-[#8b849e] hover:text-paper hover:border-[#7c3aed]/60 bg-[#12101a]/60 cursor-pointer flex items-center justify-center transition-colors"
      onClick={onClick}
      aria-label={label}
    >
      <HelpCircle size={13} />
    </button>
  );
}

export function AdminSectionTitle({
  title,
  helpOnClick,
  helpLabel,
  right,
  className,
}: {
  title: string;
  helpOnClick?: () => void;
  helpLabel?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex items-center gap-2">
        <p className="font-semibold text-[14px] text-paper">{title}</p>
        {helpOnClick && <AdminHelpButton onClick={helpOnClick} label={helpLabel || title} />}
      </div>
      {right}
    </div>
  );
}

type StatTone = "purple" | "green" | "amber" | "red";

const statToneMap: Record<StatTone, string> = {
  purple: "from-[#7c3aed]/20 to-[#7c3aed]/5 border-[#7c3aed]/35 text-[#c4b5fd]",
  green: "from-[#10b981]/20 to-[#10b981]/5 border-[#10b981]/35 text-[#6ee7b7]",
  amber: "from-[#f59e0b]/20 to-[#f59e0b]/5 border-[#f59e0b]/35 text-[#fcd34d]",
  red: "from-[#ef4444]/20 to-[#ef4444]/5 border-[#ef4444]/35 text-[#fca5a5]",
};

export function AdminStatCard({
  icon,
  label,
  value,
  hint,
  tone = "purple",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone?: StatTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border bg-gradient-to-br p-4 flex items-start justify-between gap-3",
        statToneMap[tone]
      )}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="font-display text-[28px] leading-none mt-2 text-paper">{value}</p>
        <p className="text-[11px] mt-1 opacity-70">{hint}</p>
      </div>
      <div className="h-10 w-10 rounded-[10px] border border-current/25 bg-black/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "green" | "purple" | "red" | "amber" | "neutral";
  className?: string;
}) {
  const tones = {
    green: "border-[#10b981]/45 bg-[#10b981]/12 text-[#6ee7b7]",
    purple: "border-[#7c3aed]/45 bg-[#7c3aed]/12 text-[#c4b5fd]",
    red: "border-[#ef4444]/45 bg-[#ef4444]/12 text-[#fca5a5]",
    amber: "border-[#f59e0b]/45 bg-[#f59e0b]/12 text-[#fcd34d]",
    neutral: "border-[#3a3550] bg-[#12101a]/50 text-ink-45",
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-[999px] border text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function AdminPageHeader({
  isOwner,
  updatedAt,
  onRefresh,
}: {
  isOwner: boolean;
  updatedAt: Date | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div>
        <p className="text-[12px] text-[#8b849e]">
          Админка <span className="mx-1">›</span> Owner-first модерация
        </p>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="font-display font-extrabold text-[26px] md:text-[30px] leading-tight text-paper">
            Owner-first модерация
          </h1>
          {isOwner && (
            <span className="px-2 py-0.5 rounded-[6px] border border-[#7c3aed]/50 bg-[#7c3aed]/15 text-[#c4b5fd] text-[11px] font-semibold uppercase tracking-wide">
              Owner
            </span>
          )}
        </div>
        <p className="text-[13px] text-ink-70 mt-1.5">Полный контроль модерации и аудит системы</p>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-45">
        <span>
          Обновлено:{" "}
          {updatedAt
            ? updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "—"}
        </span>
        <button
          type="button"
          className="h-8 w-8 rounded-[8px] border border-[#3a3550] bg-[#1a1828] text-ink-45 hover:text-paper cursor-pointer flex items-center justify-center"
          onClick={onRefresh}
          aria-label="Обновить"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

const quickActionTones = {
  red: "border-[#ef4444]/35 bg-[#ef4444]/8 hover:bg-[#ef4444]/15 text-[#fca5a5]",
  orange: "border-[#f97316]/35 bg-[#f97316]/8 hover:bg-[#f97316]/15 text-[#fdba74]",
  pink: "border-[#ec4899]/35 bg-[#ec4899]/8 hover:bg-[#ec4899]/15 text-[#f9a8d4]",
  green: "border-[#10b981]/35 bg-[#10b981]/8 hover:bg-[#10b981]/15 text-[#6ee7b7]",
  purple: "border-[#7c3aed]/35 bg-[#7c3aed]/8 hover:bg-[#7c3aed]/15 text-[#c4b5fd]",
};

export function AdminQuickAction({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone: keyof typeof quickActionTones;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-left cursor-pointer transition-colors",
        quickActionTones[tone]
      )}
    >
      <span className="h-9 w-9 rounded-[8px] border border-current/25 bg-black/20 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  );
}

export function AdminPrimaryButton({
  children,
  onClick,
  variant = "purple",
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "purple" | "danger" | "outline";
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    purple: "bg-[#7c3aed] hover:bg-[#6d28d9] text-white border-0 shadow-[0_0_20px_rgba(124,58,237,0.35)]",
    danger: "bg-transparent border border-[#ef4444]/60 text-[#fca5a5] hover:bg-[#ef4444]/10",
    outline: "bg-transparent border border-[#3a3550] text-paper hover:border-[#7c3aed]/50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminFilterChip({
  active,
  children,
  onClick,
  danger,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-[8px] border text-[12px] cursor-pointer transition-colors",
        active
          ? danger
            ? "border-[#ef4444]/60 bg-[#ef4444]/15 text-[#fca5a5]"
            : "border-[#7c3aed]/60 bg-[#7c3aed]/15 text-[#c4b5fd]"
          : "border-[#3a3550] bg-[#12101a]/40 text-ink-45 hover:text-paper"
      )}
    >
      {children}
    </button>
  );
}

export function AdminUserRow({
  username,
  displayName,
  email,
  role,
  onOpen,
}: {
  username: string;
  displayName?: string;
  email?: string;
  role?: string;
  onOpen: () => void;
}) {
  const initial = (username || "?").slice(0, 1).toUpperCase();
  const isAdmin = role === "admin" || role === "owner";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-[8px] hover:bg-[#12101a]/60 border-0 bg-transparent cursor-pointer text-left"
    >
      <span className="h-9 w-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center text-[13px] font-bold text-white shrink-0">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-[13px] text-paper truncate">@{username}</span>
          {isAdmin && (
            <span className="px-1.5 py-0.5 rounded-[4px] border border-[#7c3aed]/40 bg-[#7c3aed]/15 text-[#c4b5fd] text-[9px] uppercase">
              {role === "owner" ? "Owner" : "Admin"}
            </span>
          )}
        </span>
        <span className="block text-[11px] text-ink-45 truncate">{email || displayName || "—"}</span>
      </span>
    </button>
  );
}

export function AdminFooterStatus() {
  return (
    <div className="mt-6 pt-4 border-t border-[#2f2b45] flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-45">
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
        Система: все сервисы работают
      </span>
      <span>ALTER Admin · v1.0</span>
    </div>
  );
}

export { Users, Shield, FolderOpen, Clock, Zap };
