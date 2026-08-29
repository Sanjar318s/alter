"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Clapperboard,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { IconButton } from "@/components/ui/IconButton";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";
import { notifications } from "@/lib/api";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import { subscribeRealtime } from "@/lib/realtimeHub";
import { useSWRConfig } from "swr";
import { LocaleSettings } from "@/components/LocaleSettings";
import { useLocale } from "@/lib/LocaleContext";
import { panelForPath, panelHomeHref, useNavPanel, type NavPanel } from "@/lib/NavPanelContext";
import type { PlatformRole } from "@/lib/AuthContext";
import { homePathForUser } from "@/lib/appHome";
import { isAdminUser, isPlatformOwnerUser } from "@/lib/owner";
import { BrandLogo } from "@/components/ui/BrandLogo";

type LinkDef = {
  href: string | ((username: string) => string);
  id?: string;
  icon?: LucideIcon;
  labelKey?: "explore" | "reels" | "studio" | "messages";
  hintKey?: "exploreHint" | "reelsHint" | "studioHint" | "messagesHint";
  shortKey?: "explore" | "reelsShort" | "studioShort" | "chatShort";
  text?: string;
  hintText?: string;
  short?: string;
  roles: PlatformRole[];
  panel: NavPanel;
};

const LINK_DEFS: LinkDef[] = [
  {
    href: "/messages",
    icon: MessageSquare,
    labelKey: "messages",
    hintKey: "messagesHint",
    shortKey: "chatShort",
    text: "Чаты-Топики",
    hintText: "Личные диалоги и каналы/топики",
    short: "Чаты",
    roles: ["client", "blogger", "seller"],
    panel: "feed",
  },
  {
    href: "/reels",
    icon: Clapperboard,
    labelKey: "reels",
    hintKey: "reelsHint",
    shortKey: "reelsShort",
    roles: ["client", "blogger", "seller"],
    panel: "feed",
  },
  {
    href: "/market",
    icon: Compass,
    labelKey: "explore",
    hintKey: "exploreHint",
    shortKey: "explore",
    text: "Биржа",
    hintText: "Готовые работы и заказ услуги",
    short: "Биржа",
    roles: ["client", "blogger", "seller"],
    panel: "work",
  },
  {
    href: "/messages",
    icon: MessageSquare,
    labelKey: "messages",
    hintKey: "messagesHint",
    shortKey: "chatShort",
    roles: ["client", "blogger", "seller"],
    panel: "work",
  },
  {
    href: "/studio",
    id: "orders-hub",
    icon: LayoutDashboard,
    labelKey: "studio",
    hintKey: "studioHint",
    shortKey: "studioShort",
    roles: ["client", "blogger", "seller"],
    panel: "work",
  },
  {
    href: (u) => `/profile/${u}`,
    id: "own-profile",
    icon: User,
    text: "Публичный профиль",
    hintText: "Ваш публичный профиль",
    short: "Профиль",
    roles: ["client", "blogger", "seller"],
    panel: "work",
  },
];

const GUEST_LINKS: LinkDef[] = [
  {
    href: "/market",
    icon: Compass,
    labelKey: "explore",
    hintKey: "exploreHint",
    shortKey: "explore",
    text: "Биржа",
    hintText: "Готовые работы и заказ услуги",
    short: "Биржа",
    roles: [],
    panel: "work",
  },
  {
    href: "/reels",
    icon: Clapperboard,
    labelKey: "reels",
    hintKey: "reelsHint",
    shortKey: "reelsShort",
    roles: [],
    panel: "feed",
  },
];

type Notif = { id: string; type: string; payloadJson?: string; read?: boolean; createdAt?: string };

function notifText(n: Notif) {
  try {
    const p = n.payloadJson ? JSON.parse(n.payloadJson) : {};
    if (n.type === "order_created") return `Новый заказ: ${p.title || "без названия"}`;
    if (n.type === "commission_request") return p.text || `Новый заказ: ${p.title || ""}`;
    if (n.type === "order_status") return p.text || `${p.title || "Заказ"}: статус обновлён`;
    if (n.type === "payment") return `Оплата по заказу${p.amount ? `: ${p.amount}` : ""}`;
    return p.text || p.title || p.message || n.type;
  } catch {
    return n.type;
  }
}

function notifHref(n: Notif) {
  try {
    const p = n.payloadJson ? JSON.parse(n.payloadJson) : {};
    if (p.conversationId && n.type !== "order_created" && n.type !== "order_status") return `/messages/${p.conversationId}`;
    if (p.orderId) return `/studio?order=${p.orderId}`;
    if (p.conversationId) return `/messages/${p.conversationId}`;
    if (p.username) return `/profile/${p.username}`;
    if (p.buildId) return `/build/${p.buildId}`;
  } catch {
    /* ignore */
  }
  return "/me?tab=notifications";
}

function notifOrderId(n: Notif) {
  try {
    const p = n.payloadJson ? JSON.parse(n.payloadJson) : {};
    return p.orderId as string | undefined;
  } catch {
    return undefined;
  }
}

function navLinkIcon(href: string, id?: string): LucideIcon {
  if (id === "orders-hub") return LayoutDashboard;
  if (id === "own-profile") return User;
  if (href.startsWith("/messages")) return MessageSquare;
  if (href.startsWith("/reels")) return Clapperboard;
  if (href.startsWith("/market") || href.startsWith("/explore")) return Compass;
  if (href.startsWith("/studio")) return LayoutDashboard;
  if (href.startsWith("/profile")) return User;
  return Compass;
}

function MobileNavRow({
  href,
  icon: Icon,
  title,
  hint,
  active,
  badge = 0,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  active?: boolean;
  badge?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "mobile-nav-row group",
        active && "mobile-nav-row--active"
      )}
    >
      <span className={cn("mobile-nav-row-icon", active && "mobile-nav-row-icon--active")}>
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold leading-tight text-paper">{title}</span>
          {badge > 0 ? <CountBadge count={badge} /> : null}
        </span>
        {hint ? <span className="block text-[12px] text-ink-45 mt-1 leading-snug">{hint}</span> : null}
      </span>
    </Link>
  );
}

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const { user, logout } = useAuth();
  const { mutate } = useSWRConfig();
  const live = useUnreadCounts(Boolean(user));
  const msgUnread = live.messages;
  const notifUnread = live.notifications;
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLocale();
  const { panel, setPanel } = useNavPanel();
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  useEffect(() => {
    for (const r of ["/explore", "/market", "/reels", "/messages", "/studio", "/me"]) {
      try {
        router.prefetch(r);
      } catch {
        /* ignore */
      }
    }
  }, [router]);

  const isOwnerUser = isPlatformOwnerUser(user);
  const role = (isOwnerUser ? user?.platformRole ?? "seller" : user?.platformRole) ?? null;
  const LINKS = (role
    ? LINK_DEFS.filter((link) => {
        if (!link.roles.includes(role)) return false;
        return link.panel === panel;
      })
    : GUEST_LINKS
  )
    .map((link) => {
      const href =
        typeof link.href === "function"
          ? user?.username
            ? link.href(user.username)
            : "/me"
          : link.href;
      const isOwnProfile = link.id === "own-profile";
      let text = link.text || (link.labelKey ? t(link.labelKey) : "");
      let hintText = link.hintText || (link.hintKey ? t(link.hintKey) : "");
      let short = link.short || (link.shortKey ? t(link.shortKey) : "");
      if (isOwnProfile) {
        text = role === "client" ? "Публичная страница" : text || t("publicProfile");
        hintText = role === "client" ? "Как вас видят другие" : hintText || "Ваш публичный профиль";
        short = role === "client" ? "Публичная" : short || "Профиль";
      }
      if (!isOwnProfile && link.panel === "work" && link.href === "/messages") {
        text = role === "seller" ? "Чат-кл" : "ЛС с продавцами";
        short = role === "seller" ? "Чат-кл" : "ЛС";
        hintText = role === "seller"
          ? "Чаты с клиентами по заказам"
          : "Диалоги с продавцами по заказам";
      }
      if (!isOwnProfile && link.id === "orders-hub") {
        text = role === "seller" ? "Статус заказов" : "Мои заказы";
        short = role === "seller" ? "Заказы" : "Мои заказы";
        hintText = role === "seller"
          ? "Входящие заказы и статусы исполнения"
          : "Заказы, которые вы разместили как заказчик";
      }
      return {
        href,
        text,
        hintText,
        short,
        icon: link.icon || navLinkIcon(href, link.id),
        id: link.id,
      };
    });
  const isAdmin = isAdminUser(user);
  const showPanelToggle = Boolean(role) || isOwnerUser;
  const brandHref = homePathForUser(user);

  const isActive = (href: string) => {
    if (href === "/messages" && pathname.startsWith("/channels/")) return true;
    if (href === "/market" && (pathname.startsWith("/market") || pathname.startsWith("/explore"))) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setBellOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const inferred = panelForPath(pathname);
    if (inferred && inferred !== panel) setPanel(inferred);
  }, [pathname, panel, setPanel]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let stop = false;
    async function load() {
      try {
        const list = await notifications.list();
        if (stop) return;
        setItems((list.notifications || []).slice(0, 8));
      } catch {
        /* offline */
      }
    }
    load();
    const t = window.setInterval(load, 60000);
    const unsub = subscribeRealtime((event) => {
      if (event === "message" || event === "notification") load();
    });
    return () => {
      stop = true;
      window.clearInterval(t);
      unsub();
    };
  }, [user]);

  return (
    <>
      <nav className={cn("sticky top-0 w-full bg-ink/92 backdrop-blur-md border-b border-line px-4 sm:px-6 lg:px-8 py-2.5 overflow-x-clip", mobileOpen ? "z-[80]" : "z-50")}>
        <div className="max-w-[1360px] mx-auto w-full min-w-0 flex items-center gap-3">
          <BrandLogo href={brandHref} />

          <div className="hidden md:flex flex-1 justify-center items-center gap-1 min-w-0 overflow-hidden px-1">
            {LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
              <Link
                key={`${link.href}-${link.text}`}
                href={link.href}
                title={link.hintText}
                className={cn(
                  "relative inline-flex items-center gap-2 px-2.5 lg:px-3.5 py-2 text-[13px] no-underline rounded-[8px] border transition-colors whitespace-nowrap shrink-0",
                  active
                    ? "text-paper bg-stage-elevated/70 border-line shadow-[0_0_24px_rgba(212,86,122,0.12)]"
                    : "text-ink-70 border-transparent hover:text-paper hover:bg-stage/50"
                )}
              >
                <Icon size={17} strokeWidth={1.75} className={cn("shrink-0", active ? "text-magenta" : "text-ink-45")} />
                <span className="hidden xl:inline">{link.text}</span>
                <span className="xl:hidden">{link.short}</span>
                {link.href === "/messages" && msgUnread > 0 ? <CountBadge count={msgUnread} /> : null}
              </Link>
            );
            })}
          </div>

          <div className="hidden md:flex items-center gap-1 shrink-0 ml-auto">
            <IconButton
              label={t("search")}
              className="w-9 h-9"
              onClick={() => router.push("/explore?focus=1")}
            >
              <Search size={18} strokeWidth={1.75} />
            </IconButton>
            <div className="relative">
              <IconButton
                label={t("settings")}
                className="w-9 h-9"
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setBellOpen(false);
                }}
              >
                <Settings size={18} strokeWidth={1.75} />
              </IconButton>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-stage border border-line z-50">
                  <LocaleSettings />
                </div>
              )}
            </div>
            {showPanelToggle && (
              <div
                className="hidden md:inline-flex border border-line rounded-[8px] h-9 overflow-hidden p-0.5 bg-ink/40"
                role="tablist"
                aria-label="Режим меню"
              >
                {(
                  [
                    { id: "feed" as const, label: "Лента" },
                    { id: "work" as const, label: "Биржа" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={panel === tab.id}
                    onClick={() => {
                      setPanel(tab.id);
                      if (panelForPath(pathname) !== tab.id) {
                        router.push(panelHomeHref(tab.id));
                      }
                    }}
                    className={cn(
                      "px-3 text-[10px] font-mono uppercase tracking-[0.12em] border-0 h-full rounded-[6px] transition-colors",
                      panel === tab.id
                        ? "bg-magenta/20 text-paper shadow-[inset_0_0_0_1px_rgba(212,86,122,0.35)]"
                        : "bg-transparent text-ink-45 hover:text-paper"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <span className="w-px h-5 bg-line mx-0.5 hidden xl:block" />
            <div className="relative">
              <IconButton label={t("notifications")} className="w-9 h-9" onClick={() => setBellOpen((v) => !v)}>
                <span className="relative">
                  <Bell size={18} strokeWidth={1.75} />
                  {notifUnread > 0 && <CountBadge count={notifUnread} dot className="absolute -top-1.5 -right-2" />}
                </span>
              </IconButton>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-stage border border-line z-50 p-2">
                  {items.length === 0 && (
                    <div className="px-2 py-4 text-[12px] text-ink-45 text-center">{t("noNotifications")}</div>
                  )}
                  {items.map((n) => {
                    const oid = notifOrderId(n);
                    return (
                      <div
                        key={n.id}
                        className={cn("px-2 py-2 text-[12px] border-b border-line last:border-0", n.read ? "text-ink-45" : "text-paper")}
                      >
                        <Link
                          href={notifHref(n)}
                          className="block no-underline text-inherit"
                          onClick={async () => {
                            setBellOpen(false);
                            if (!n.read) {
                              await notifications.markRead(n.id).catch(() => {});
                              mutate("/api/notifications/unread-count");
                            }
                          }}
                        >
                          {notifText(n)}
                        </Link>
                        {oid && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1.5 border-magenta text-magenta hover:border-magenta"
                            href={`/studio?order=${oid}`}
                            onClick={async () => {
                              setBellOpen(false);
                              if (!n.read) {
                                await notifications.markRead(n.id).catch(() => {});
                                mutate("/api/notifications/unread-count");
                              }
                            }}
                          >
                            {t("more")}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {items.length > 0 && (
                    <button
                      type="button"
                      className="w-full text-center text-[12px] text-magenta py-2 bg-transparent border-0"
                      onClick={async () => {
                        await notifications.markAllRead().catch(() => {});
                        mutate("/api/notifications/unread-count");
                        setItems((list) => list.map((n) => ({ ...n, read: true })));
                      }}
                    >
                      {t("markAllRead")}
                    </button>
                  )}
                </div>
              )}
            </div>
            {user ? (
              <div className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-2 bg-transparent border-0 text-paper cursor-pointer"
                >
                  <span className="w-8 h-8 bg-stage border border-line shrink-0 overflow-hidden">
                    <SmartImage src={user.avatarUrl} alt={user.username} fallback={user.username} size="thumb" />
                  </span>
                  <span className="text-left hidden xl:block">
                    <span className="block text-[13px] leading-tight">{user.username}</span>
                    <span className="block text-[11px] text-ink-45">{t("profile")}</span>
                  </span>
                  <ChevronDown size={14} className="text-ink-45" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-stage border border-line py-1 z-50">
                    {(role === "seller" || role === "blogger" || role === "client") && (
                      <Link href={`/profile/${user.username}`} className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                        {role === "client" ? "Мой профиль" : t("publicProfile")}
                      </Link>
                    )}
                    <Link href="/me" className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                      {role === "client" ? "Настройки" : t("myProfile")}
                    </Link>
                    {(role === "seller" || role === "blogger" || role === "client") && (
                      <Link href="/studio" className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                        {role === "seller" ? "Статус заказов" : "Мои заказы"}
                      </Link>
                    )}
                    {isAdmin && (
                      <Link href="/admin" className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                        {t("admin")}
                      </Link>
                    )}
                    <button type="button" className="w-full text-left px-3 py-2 text-[13px] text-ink-45" onClick={() => { logout(); setMenuOpen(false); }}>
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 ml-1">
                <Button href="/login" variant="outline" size="sm" className="hidden xl:inline-flex px-3">
                  {t("login")}
                </Button>
                <Button href="/register" size="sm" className="px-3">
                  <span className="hidden xl:inline">{t("createProfile")}</span>
                  <span className="xl:hidden">{t("register")}</span>
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto md:hidden">
            <IconButton
              label={t("search")}
              onClick={() => router.push("/explore?focus=1")}
            >
              <Search size={18} strokeWidth={1.75} />
            </IconButton>
            {user && (
              <div className="relative">
                <IconButton label={t("notifications")} onClick={() => setBellOpen((v) => !v)}>
                  <span className="relative">
                    <Bell size={18} strokeWidth={1.75} />
                    {notifUnread > 0 && <CountBadge count={notifUnread} dot className="absolute -top-1.5 -right-2" />}
                  </span>
                </IconButton>
                {bellOpen && (
                  <div className="fixed inset-x-3 top-14 max-h-[60vh] overflow-y-auto bg-stage border border-line z-[70] p-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-none">
                    {items.length === 0 && (
                      <div className="px-2 py-4 text-[12px] text-ink-45 text-center">{t("noNotifications")}</div>
                    )}
                    {items.map((n) => (
                      <div
                        key={n.id}
                        className={cn("px-2 py-2 text-[12px] border-b border-line last:border-0", n.read ? "text-ink-45" : "text-paper")}
                      >
                        <Link
                          href={notifHref(n)}
                          className="block no-underline text-inherit"
                          onClick={async () => {
                            setBellOpen(false);
                            if (!n.read) {
                              await notifications.markRead(n.id).catch(() => {});
                              mutate("/api/notifications/unread-count");
                            }
                          }}
                        >
                          {notifText(n)}
                        </Link>
                      </div>
                    ))}
                    <Link
                      href="/me?tab=notifications"
                      className="block text-center text-[12px] text-magenta py-2 no-underline"
                      onClick={() => setBellOpen(false)}
                    >
                      {t("notifications")}
                    </Link>
                  </div>
                )}
              </div>
            )}
            {!user && (
              <Button href="/register" size="sm" className="hidden min-[420px]:inline-flex">
                {t("createProfile")}
              </Button>
            )}
            <button
              type="button"
              className="text-paper w-11 h-11 flex items-center justify-center bg-transparent border-0"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm border-0 cursor-default"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
          />
          <div className="mobile-nav-sheet absolute inset-x-0 top-[57px] bottom-0 overflow-y-auto">
            {showPanelToggle && (
              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">Режим</div>
                <div className="mobile-nav-mode-grid" role="tablist" aria-label="Режим меню">
                  {(
                    [
                      { id: "feed" as const, label: "Лента", hint: "Рилсы и чаты" },
                      { id: "work" as const, label: "Биржа", hint: "Работы и заказы" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={panel === tab.id}
                      onClick={() => {
                        setPanel(tab.id);
                        setMobileOpen(false);
                        if (panelForPath(pathname) !== tab.id) {
                          router.push(panelHomeHref(tab.id));
                        }
                      }}
                      className={cn(
                        "mobile-nav-mode-tab",
                        panel === tab.id && "mobile-nav-mode-tab--active"
                      )}
                    >
                      <div className="text-[14px] font-semibold leading-none">{tab.label}</div>
                      <div className="text-[11px] mt-1 text-ink-45">{tab.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mobile-nav-section">
              <div className="mobile-nav-section-title">
                {showPanelToggle ? (panel === "feed" ? "Лента" : "Биржа") : "Меню"}
              </div>
              <nav className="mobile-nav-list">
                {LINKS.map((link) => (
                  <MobileNavRow
                    key={`${panel}-${link.href}-${link.text}`}
                    href={link.href}
                    icon={link.icon}
                    title={link.text}
                    hint={link.hintText}
                    active={isActive(link.href)}
                    badge={link.href === "/messages" ? msgUnread : 0}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
            </div>

            <div className="mobile-nav-section">
              <div className="mobile-nav-section-title">Аккаунт</div>
              {user ? (
                <div className="mobile-nav-list">
                  <MobileNavRow
                    href="/me"
                    icon={User}
                    title={t("myProfile")}
                    hint={`@${user.username}`}
                    active={pathname === "/me"}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  {isAdmin && (
                    <MobileNavRow
                      href="/admin"
                      icon={Shield}
                      title={t("admin")}
                      hint="Модерация и owner-панель"
                      active={pathname.startsWith("/admin")}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="mobile-nav-logout"
                  >
                    <LogOut size={17} strokeWidth={1.75} className="shrink-0 opacity-80" />
                    <span className="text-[15px] font-medium">{t("logout")}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <Button href="/register" size="sm" className="w-full min-[420px]:hidden">
                    {t("createProfile")}
                  </Button>
                  <div className="flex gap-2">
                    <Button href="/login" variant="outline" size="sm" className="flex-1">
                      {t("login")}
                    </Button>
                    <Button href="/register" size="sm" className="flex-1 min-[420px]:flex hidden">
                      {t("createProfile")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="mobile-nav-footer">
              <button
                type="button"
                onClick={() => setMobileSettingsOpen((v) => !v)}
                className="mobile-nav-settings-toggle"
                aria-expanded={mobileSettingsOpen}
              >
                <span className="inline-flex items-center gap-2.5 text-[14px] font-medium text-paper">
                  <Settings size={16} strokeWidth={1.75} className="text-ink-45" />
                  Язык и валюта
                </span>
                <ChevronDown
                  size={16}
                  className={cn("text-ink-45 transition-transform", mobileSettingsOpen && "rotate-180")}
                />
              </button>
              {mobileSettingsOpen && (
                <div className="px-1 pb-2">
                  <LocaleSettings compact />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
