"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

const PERSONAL: { href: string; label: MsgKey; icon: typeof User; tab?: string }[] = [
  { href: "/me", label: "myProfile", icon: User },
  { href: "/me?tab=notifications", label: "notifications", icon: Bell, tab: "notifications" },
  { href: "/me?tab=security", label: "security", icon: Shield, tab: "security" },
  { href: "/me?tab=socials", label: "integrations", icon: Images, tab: "socials" },
];

function isPersonalNavActive(href: string, pathname: string, tab: string | null) {
  if (pathname !== "/me") return false;
  if (href === "/me") {
    return !tab || tab === "info" || tab === "portfolio" || tab === "reels";
  }
  const match = href.match(/tab=([^&]+)/);
  return match?.[1] === tab;
}

const MANAGEMENT = [
  { href: "/admin", label: "Owner-first модерация", icon: Shield },
];

function PersonalNavLinks({
  pathname,
  setOpen,
  t,
}: {
  pathname: string;
  setOpen: (open: boolean) => void;
  t: (key: MsgKey) => string;
}) {
  const meTab = useSearchParams().get("tab");

  return (
    <>
      {PERSONAL.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={cn(
            "studio-nav-link",
            isPersonalNavActive(l.href, pathname, meTab) && "studio-nav-link--active"
          )}
        >
          <l.icon size={16} strokeWidth={1.75} />
          {t(l.label)}
        </Link>
      ))}
    </>
  );
}

function PersonalNavLinksFallback({
  setOpen,
  t,
}: {
  setOpen: (open: boolean) => void;
  t: (key: MsgKey) => string;
}) {
  return (
    <>
      {PERSONAL.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className="studio-nav-link"
        >
          <l.icon size={16} strokeWidth={1.75} />
          {t(l.label)}
        </Link>
      ))}
    </>
  );
}

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
          "studio-nav-link",
          pathname === l.href && "studio-nav-link--active",
          locked && "opacity-60"
        );
        const inner = (
          <>
            <l.icon size={16} strokeWidth={1.75} />
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
                "studio-nav-link",
                pathname.startsWith("/admin") && "studio-nav-link--active"
              )}
            >
              <l.icon size={16} strokeWidth={1.75} />
              {l.label}
            </Link>
          ))}
        </>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-45 px-4 mt-6 mb-2">{t("personal")}</div>
      <Suspense fallback={<PersonalNavLinksFallback setOpen={setOpen} t={t} />}>
        <PersonalNavLinks pathname={pathname} setOpen={setOpen} t={t} />
      </Suspense>
      <div className="mt-auto p-4 border-t border-line">
        {showPremiumProgress ? (
          <div className="studio-premium-footer">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber mb-1">{t("premium")}</div>
            <div className="text-[12px] text-ink-45 mb-3 leading-snug">{premiumLabel}</div>
            <Button href="/me" variant="outline" size="sm" className="w-full">
              Смотреть прогресс
            </Button>
          </div>
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
        className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] right-4 z-50 w-11 h-11 bg-stage border border-line text-paper shadow-lg"
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
      <div className="flex-1 min-w-0 overflow-y-auto studio-scroll-pad">{children}</div>
    </div>
  );
}
