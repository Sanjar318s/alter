"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { account } from "@/lib/api";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  User,
  Users,
  Wallet,
  Bell,
  Images,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import { PAYMENTS_LIVE } from "@/lib/flags";
import { useLocale } from "@/lib/LocaleContext";
import type { MsgKey } from "@/lib/locale/messages";
import { isPlatformOwnerUser } from "@/lib/owner";

const STUDIO_SELLER: { href: string; label: MsgKey; icon: typeof LayoutDashboard; unread?: boolean; beta?: boolean }[] = [
  { href: "/studio", label: "studio", icon: LayoutDashboard },
  { href: "/studio/calendar", label: "calendar", icon: CalendarDays },
  { href: "/messages", label: "messages", icon: MessageSquare, unread: true },
  { href: "/studio/clients", label: "clients", icon: Users },
  { href: "/studio/finance", label: "finance", icon: Wallet, beta: true },
  { href: "/explore", label: "portfolio", icon: Images },
  { href: "/studio/analytics", label: "analytics", icon: BarChart3 },
];

const STUDIO_BUYER: { href: string; label: MsgKey; icon: typeof LayoutDashboard; unread?: boolean; beta?: boolean }[] = [
  { href: "/studio", label: "studio", icon: LayoutDashboard },
  { href: "/studio/calendar", label: "calendar", icon: CalendarDays },
  { href: "/messages", label: "messages", icon: MessageSquare, unread: true },
];

const PERSONAL: { href: string; label: MsgKey; icon: typeof User }[] = [
  { href: "/me", label: "myProfile", icon: User },
  { href: "/me?tab=notifications", label: "notifications", icon: Bell },
  { href: "/me?tab=security", label: "security", icon: Shield },
  { href: "/me?tab=socials", label: "integrations", icon: Images },
];

const MANAGEMENT = [
  { href: "/admin", label: "Owner-first модерация", icon: Shield },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCounts(Boolean(user));
  const { t } = useLocale();
  const isOwnerUser = isPlatformOwnerUser(user);
  const isAdmin =
    (user?.roleFlags || "").split(",").map((s) => s.trim()).includes("admin") || isOwnerUser;
  const isBuyerRole =
    !isOwnerUser && (user?.platformRole === "client" || user?.platformRole === "blogger");
  const studioLinks = isBuyerRole ? STUDIO_BUYER : STUDIO_SELLER;
  const showPremiumProgress = user?.platformRole === "blogger" || isOwnerUser;
  const [premiumLabel, setPremiumLabel] = useState("Прогресс к Premium");

  useEffect(() => {
    if (!showPremiumProgress || !user) {
      setPremiumLabel("Прогресс к Premium");
      return;
    }
    let alive = true;
    account
      .premium()
      .then((r) => {
        if (!alive) return;
        const g = r.progress?.activeGrant;
        if (g?.endsAt) {
          setPremiumLabel(`Premium до ${new Date(g.endsAt).toLocaleDateString("ru")}`);
        } else if (r.progress) {
          const yt = `${r.progress.youtubeReelsAt1M}/${r.progress.youtubeReelsNeeded} YT`;
          setPremiumLabel(`Прогресс к Premium · ${yt}`);
        }
      })
      .catch(() => {
        if (alive) setPremiumLabel("Прогресс к Premium");
      });
    return () => {
      alive = false;
    };
  }, [showPremiumProgress, user?.id]);

  const NavBody = (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-45 px-4 mb-2">
        {isBuyerRole ? "Мои заказы" : t("studioShort")}
      </div>
      {studioLinks.map((l) => {
        const locked = Boolean((l as { beta?: boolean }).beta) && !PAYMENTS_LIVE;
        const cls = cn(
          "flex items-center gap-2 px-4 py-2 text-[13px] no-underline border-l-2",
          pathname === l.href ? "border-magenta text-paper" : "border-transparent text-ink-70 hover:text-paper",
          locked && "opacity-60"
        );
        const inner = (
          <>
            <l.icon size={16} />
            {t(l.label)}
            {locked && <span className="ml-auto font-mono text-[9px] uppercase text-amber">Beta</span>}
            {(l as { unread?: boolean }).unread && unread.messages > 0 ? (
              <CountBadge count={unread.messages} className="ml-auto" />
            ) : null}
          </>
        );
        if (locked) {
          return (
            <span key={l.href} className={cls} title={t("betaTesting")}>
              {inner}
            </span>
          );
        }
        return (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cls}>
            {inner}
          </Link>
        );
      })}
      {isAdmin && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-45 px-4 mt-6 mb-2">Управление</div>
          {MANAGEMENT.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-[13px] no-underline border-l-2",
                pathname.startsWith("/admin")
                  ? "border-magenta text-paper"
                  : "border-transparent text-ink-70 hover:text-paper"
              )}
            >
              <l.icon size={16} />
              {l.label}
            </Link>
          ))}
        </>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-45 px-4 mt-6 mb-2">{t("personal")}</div>
      {PERSONAL.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-[13px] no-underline border-l-2",
            pathname === "/me" && l.href === "/me"
              ? "border-magenta text-paper"
              : "border-transparent text-ink-70 hover:text-paper"
          )}
        >
          <l.icon size={16} />
          {t(l.label)}
        </Link>
      ))}
      <div className="mt-auto p-4 border-t border-line">
        {showPremiumProgress ? (
          <>
            <div className="font-mono text-[10px] text-amber mb-1">{t("premium")}</div>
            <div className="text-[12px] text-ink-45 mb-3">{premiumLabel}</div>
            <Button href="/me" variant="outline" size="sm" className="w-full mb-2">
              Смотреть прогресс
            </Button>
          </>
        ) : null}
        <button
          type="button"
          className="flex items-center gap-2 text-[13px] text-ink-45 bg-transparent border-0"
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          <LogOut size={14} /> {t("logout")}
        </button>
        <div className="text-[11px] text-ink-45 mt-2">{user?.username || "—"}</div>
      </div>
    </>
  );

  return (
    <div className="flex flex-1 min-h-0 min-w-0 max-w-full overflow-x-clip">
      <aside className="hidden md:flex w-[205px] shrink-0 border-r border-line bg-stage flex-col py-4">
        {NavBody}
      </aside>
      <button
        type="button"
        className="md:hidden fixed bottom-16 left-4 z-50 w-11 h-11 bg-stage border border-line text-paper shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Меню студии"
      >
        <Menu size={18} className="mx-auto" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/80 md:hidden" onClick={() => setOpen(false)}>
          <div className="w-[240px] h-full bg-stage border-r border-line flex flex-col py-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="self-end mr-2 mb-2 bg-transparent border-0 text-paper" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
            {NavBody}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
