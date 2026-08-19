"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react";
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

const LINK_DEFS = [
  { href: "/explore", label: "explore" as const, hint: "exploreHint" as const, short: "explore" as const },
  { href: "/studio", label: "studio" as const, hint: "studioHint" as const, short: "studioShort" as const },
  { href: "/messages", label: "messages" as const, hint: "messagesHint" as const, short: "chatShort" as const },
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
  const LINKS = LINK_DEFS.map((link) => ({
    ...link,
    text: t(link.label),
    hintText: t(link.hint),
    short: t(link.short),
  }));
  const isAdmin =
    (user?.roleFlags || "").split(",").map((s) => s.trim()).includes("admin") ||
    (user?.username || "").toLowerCase() === "nyx.cosplay";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setBellOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

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
      <nav className="sticky top-0 z-50 w-full bg-ink/95 backdrop-blur-sm border-b border-line px-4 sm:px-6 lg:px-8 py-3 overflow-x-clip">
        <div className="max-w-[1360px] mx-auto w-full min-w-0 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-paper no-underline shrink-0">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-gradient-to-br from-magenta to-amber" />
            <span className="font-display font-extrabold text-lg tracking-tight">ALTER</span>
          </Link>

          <div className="hidden md:flex flex-1 justify-center items-center gap-0.5 min-w-0 overflow-hidden px-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={link.hintText}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2 lg:px-3 py-2 text-[13px] lg:text-sm no-underline border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
                  isActive(link.href)
                    ? "text-paper border-magenta"
                    : "text-ink-45 border-transparent hover:text-paper"
                )}
              >
                <span className="hidden xl:inline">{link.text}</span>
                <span className="xl:hidden">{link.short}</span>
                {link.href === "/messages" && msgUnread > 0 ? <CountBadge count={msgUnread} /> : null}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-0.5 shrink-0 ml-auto">
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
                    <SmartImage src={user.avatarUrl} alt={user.username} fallback={user.username} />
                  </span>
                  <span className="text-left hidden xl:block">
                    <span className="block text-[13px] leading-tight">{user.username}</span>
                    <span className="block text-[11px] text-ink-45">{t("profile")}</span>
                  </span>
                  <ChevronDown size={14} className="text-ink-45" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-stage border border-line py-1 z-50">
                    <Link href={`/profile/${user.username}`} className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                      {t("publicProfile")}
                    </Link>
                    <Link href="/me" className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                      {t("myProfile")}
                    </Link>
                    <Link href="/studio" className="block px-3 py-2 text-[13px] no-underline text-paper hover:bg-ink" onClick={() => setMenuOpen(false)}>
                      {t("studioShort")}
                    </Link>
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
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm border-0 cursor-default"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-0 top-[57px] bottom-0 bg-ink border-t border-line overflow-y-auto px-5 py-6 flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "no-underline px-1 py-3 border-b border-line/60",
                  isActive(link.href) ? "text-paper" : "text-ink-45"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-medium">{link.text}</div>
                  {link.href === "/messages" && msgUnread > 0 ? <CountBadge count={msgUnread} /> : null}
                </div>
                <div className="text-[12px] text-ink-45 mt-0.5">{link.hintText}</div>
              </Link>
            ))}

            <div className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
              <div className="bg-stage border border-line">
                <LocaleSettings />
              </div>
              {user ? (
                <>
                  <Link href="/me" className="text-[15px] text-paper no-underline py-2" onClick={() => setMobileOpen(false)}>
                    {t("myProfile")} · {user.username}
                  </Link>
                  <Link href={`/profile/${user.username}`} className="text-[14px] text-ink-70 no-underline py-1" onClick={() => setMobileOpen(false)}>
                    {t("publicProfile")}
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="text-[14px] text-ink-70 no-underline py-1" onClick={() => setMobileOpen(false)}>
                      {t("admin")}
                    </Link>
                  )}
                  <button type="button" onClick={() => { logout(); setMobileOpen(false); }} className="text-[14px] text-ink-45 text-left py-2 bg-transparent border-0">
                    {t("logout")}
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
