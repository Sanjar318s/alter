"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  Ellipsis,
  ExternalLink,
  Flag,
  GalleryVerticalEnd,
  Heart,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Frame } from "@/components/Frame";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { CreatePublicationModal } from "@/components/profile/CreatePublicationModal";
import { PostLightbox } from "@/components/profile/PostLightbox";
import { PublicationGrid } from "@/components/profile/PublicationGrid";
import { StoryRingStrip } from "@/components/profile/StoryRingStrip";
import { StoryViewer } from "@/components/profile/StoryViewer";
import { CreateBuildModal } from "@/components/builds/CreateBuildModal";
import { BuildCard } from "@/components/builds/BuildCard";
import { CommissionRequestForm } from "@/components/orders/CommissionRequestForm";
import { SmartImage } from "@/components/media/SmartImage";
import { StaffBadge } from "@/components/staff/StaffBadge";
import { PartnerBadge } from "@/components/profile/PartnerBadge";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/lib/LocaleContext";
import { normalizePublication, type Publication } from "@/lib/demo/publications";
import { messages, publications as publicationsApi, users } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { subscribeRealtime } from "@/lib/realtimeHub";

type Tab = "builds" | "orders" | "stories" | "about" | "publications";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return (
    <Suspense fallback={<div className="p-6 font-mono text-ink-45">Загрузка…</div>}>
      <ProfileHub username={decodeURIComponent(username)} />
    </Suspense>
  );
}

function ProfileHub({ username }: { username: string }) {
  const { user } = useAuth();
  const { formatSum } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "builds";
  const [view, setView] = useState<"grid" | "list">("grid");
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [apiBuilds, setApiBuilds] = useState<any[] | null>(null);
  const [stats, setStats] = useState({ builds: 0, followers: 0, following: 0, likes: 0, orders: 0 });
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [listUsers, setListUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Publication[]>([]);
  const [activeStories, setActiveStories] = useState<Publication[]>([]);
  const [selectedPost, setSelectedPost] = useState<Publication | null>(null);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"post" | "story">("post");
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [orderMeta, setOrderMeta] = useState<{ avgBudget: number | null; deadlineCount: number }>({ avgBudget: null, deadlineCount: 0 });

  const isOwner = user?.username === username;
  const isPlatformOwner = username.toLowerCase() === "nyx.cosplay" || profile?.profile?.staffRole === "owner";
  const cards = apiBuilds || [];

  useEffect(() => {
    users
      .get(username)
      .then((d) => {
        setProfile(d);
        setApiBuilds(d.builds);
        if (d.stats) setStats({ builds: d.stats.builds, followers: d.stats.followers, following: d.stats.following, likes: d.stats.likes, orders: d.stats.orders || 0 });
        if (d.events?.length) setEvents(d.events);
        setFollowing(Boolean(d.isFollowing));
        document.title = `${username} — ALTER`;
      })
      .catch(() => {
        setNotFound(true);
        document.title = `${username} — ALTER`;
      });
    users
      .orders(username)
      .then((d) => {
        setHistoryOrders(d.orders || []);
        setOrderMeta({ avgBudget: d.avgBudget, deadlineCount: d.deadlineCount });
      })
      .catch(() => {
        setHistoryOrders([]);
        setOrderMeta({ avgBudget: null, deadlineCount: 0 });
      });
  }, [username]);

  useEffect(() => {
    return subscribeRealtime((event, data) => {
      if (event !== "stats" || !data || typeof data !== "object") return;
      const row = data as { username?: string; stats?: typeof stats };
      if (row.username === username && row.stats) {
        setStats((prev) => ({ ...prev, ...row.stats }));
      }
    });
  }, [username]);

  async function toggleFollow() {
    const prev = following;
    setFollowing(!prev);
    setStats((s) => ({
      ...s,
      followers: Math.max(0, s.followers + (prev ? -1 : 1)),
    }));
    try {
      const res = prev ? await users.unfollow(username) : await users.follow(username);
      if (res.stats) {
        setStats((s) => ({ ...s, ...res.stats! }));
      }
      if (listOpen === "followers") {
        users.followers(username).then((d) => setListUsers(d.users || [])).catch(() => {});
      }
    } catch (e) {
      setFollowing(prev);
      setStats((s) => ({
        ...s,
        followers: Math.max(0, s.followers + (prev ? 1 : -1)),
      }));
      toast(e instanceof Error ? e.message : "Не удалось подписаться", true);
    }
  }

  useEffect(() => {
    publicationsApi
      .list(username)
      .then((d) => {
        if (d.publications?.length) {
          setPosts(d.publications.map(normalizePublication));
        }
      })
      .catch(() => {
        setPosts([]);
      });
    publicationsApi
      .activeStories(username)
      .then((d) => {
        setActiveStories((d.stories || []).map(normalizePublication));
      })
      .catch(() => {
        setActiveStories([]);
      });
  }, [username]);

  if (notFound) {
    return (
      <div className="pt-16 px-4 sm:px-6">
        <EmptyState
          title="Профиль не найден"
          description="Такого ника нет. Посмотри Explore."
          action={<Button href="/explore">Исследовать</Button>}
        />
      </div>
    );
  }

  const p = profile?.profile;
  const status = (p?.commissionStatus || "closed") as "open" | "closed" | "waitlist";
  const roles = (profile?.user?.roleFlags || "cosplayer").split(",");
  const bio = p?.bio || "";
  const city = [p?.city, p?.country].filter(Boolean).join(", ");
  let links: Record<string, string> = {};
  try {
    if (p?.linksJson) links = JSON.parse(p.linksJson);
  } catch {
    /* keep demo */
  }

  function setTab(next: Tab) {
    router.replace(`/profile/${username}?tab=${next}`, { scroll: false });
  }

  async function message() {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const id = profile?.user?.id;
      if (id) {
        const conv = await messages.createConversation(id);
        router.push(`/messages?c=${conv.conversationId}`);
        return;
      }
    } catch {
      /* demo */
    }
    router.push("/messages");
  }

  async function share() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast("Ссылка скопирована");
  }

  return (
    <>
      <header className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 border-b border-line overflow-x-clip">
        <div className="max-w-[1240px] mx-auto flex flex-wrap gap-6 items-start min-w-0">
          <div className="relative">
            <Frame className="w-[104px] h-[104px] overflow-hidden">
              <SmartImage src={profile?.profile?.avatarUrl} alt={username} fallback={username} />
            </Frame>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-magenta border-2 border-ink" />
          </div>
          <div className="flex-1 min-w-0 basis-[min(100%,240px)]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display font-extrabold text-[clamp(28px,6vw,52px)] leading-none break-all">{username}</h1>
              {p?.isVerified && <BadgeCheck className="text-magenta" size={22} />}
              <StaffBadge role={p?.staffRole || "none"} hidden={p?.staffBadgeHidden} />
              <Badge status={status} />
            </div>
            <div className="flex gap-2 mt-3">
              {roles.map((r: string) => (
                <span
                  key={r}
                  className={cn(
                    "font-mono text-[11px] uppercase px-2.5 py-1 rounded-[4px]",
                    r.includes("maker") ? "bg-amber text-ink" : "bg-magenta text-paper"
                  )}
                >
                  {r.includes("photo") ? "Фотограф" : r.includes("maker") ? "Мейкер" : "Косплеер"}
                </span>
              ))}
            </div>
            {profile?.user?.id && <PartnerBadge userId={profile.user.id} />}
            <div className="flex items-center gap-2 mt-3 text-[13px] text-ink-70">
              <MapPin size={14} /> {city || "Город не указан"}
              {p?.lastSeen && (
                <span className="font-mono text-[11px] text-ink-45">
                  · Была в сети {new Date(p.lastSeen).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-[14px] text-ink-70 mt-3 max-w-[560px]">{bio}</p>
            <div className="flex gap-3 mt-3">
              {Object.entries(links).map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="text-ink-45 hover:text-magenta flex items-center gap-1">
                  <BrandIcon name={name} size={16} />
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto relative justify-end">
            {isOwner ? (
              <>
                <Button href="/me" variant="outline" size="sm" className="hidden sm:inline-flex">Редактировать профиль</Button>
                <Button href="/me?tab=security" variant="outline" size="sm" className="hidden md:inline-flex">Настройки</Button>
                <Button size="sm" onClick={() => setBuildOpen(true)} className="hidden sm:inline-flex">+ Добавить билд</Button>
                <Button href="/me" variant="outline" size="sm" className="sm:hidden">Редактировать</Button>
                <Button size="sm" onClick={() => setBuildOpen(true)} className="sm:hidden">+ Билд</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => setCommissionOpen(true)} className="w-full sm:w-auto">
                  <Sparkles size={14} className="mr-1" /> Запросить коммишен
                </Button>
                <Button variant="outline" size="sm" onClick={message} className="hidden sm:inline-flex">
                  <Send size={14} className="mr-1" /> Написать сообщение
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={toggleFollow}
                >
                  <UserPlus size={14} className="mr-1" /> {following ? "Вы подписаны" : "Подписаться"}
                </Button>
              </>
            )}
            <IconButton label="Ещё" onClick={() => setMenuOpen((v) => !v)}>
              <Ellipsis size={18} />
            </IconButton>
            {menuOpen && (
              <div className="absolute right-0 top-12 bg-stage border border-line w-48 z-20 py-1">
                <button type="button" className="w-full text-left px-3 py-2 text-[13px]" onClick={share}>
                  <Share2 size={14} className="inline mr-2" /> Поделиться
                </button>
                {!isOwner && (
                  <>
                    <button type="button" className="w-full text-left px-3 py-2 text-[13px] sm:hidden" onClick={message}>
                      <Send size={14} className="inline mr-2" /> Написать сообщение
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-[13px] sm:hidden" onClick={() => { toggleFollow(); setMenuOpen(false); }}>
                      <UserPlus size={14} className="inline mr-2" /> {following ? "Вы подписаны" : "Подписаться"}
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-[13px]" onClick={async () => {
                      await messages.report({ targetType: "user", targetId: profile?.user?.id || username, reason: "abuse" });
                      toast("Жалоба отправлена модераторам");
                    }}>
                      <Flag size={14} className="inline mr-2" /> Пожаловаться
                    </button>
                    {!isPlatformOwner && (
                    <button type="button" className="w-full text-left px-3 py-2 text-[13px] text-[#FF426F]" onClick={async () => {
                      if (profile?.user?.id) await messages.block(profile.user.id);
                      toast("Пользователь в чёрном списке");
                    }}>
                      Заблокировать
                    </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-10 min-w-0">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div>
            <div className="flex border-b border-line mb-5 overflow-x-auto">
              {(["builds", "orders", "stories", "about", "publications"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-3 text-[13px] uppercase tracking-wide border-b-2 bg-transparent whitespace-nowrap shrink-0",
                    tab === t ? "border-magenta text-paper" : "border-transparent text-ink-45"
                  )}
                >
                  {t === "builds" ? "Билды" : t === "orders" ? "Заказы" : t === "stories" ? "Истории" : t === "about" ? "О себе" : "Публикации"}
                </button>
              ))}
            </div>

            {tab === "builds" && (
              <>
                <div className="flex items-center mb-4">
                  <span className="text-[13px] text-ink-45">{stats.builds || cards.length} билдов</span>
                  <div className="ml-auto flex">
                    <IconButton label="Сетка" onClick={() => setView("grid")}>
                      <LayoutGrid size={16} className={view === "grid" ? "text-magenta" : ""} />
                    </IconButton>
                    <IconButton label="Список" onClick={() => setView("list")}>
                      <List size={16} className={view === "list" ? "text-magenta" : ""} />
                    </IconButton>
                  </div>
                </div>
                {cards.length === 0 ? (
                  <EmptyState
                    title={isOwner ? "Пока нет билдов" : "пока нет опубликованных билдов"}
                    action={isOwner ? <Button size="sm" onClick={() => setBuildOpen(true)}>+ Добавить билд</Button> : undefined}
                  />
                ) : view === "grid" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cards.map((b: any) => (
                      <BuildCard
                        key={b.id}
                        id={b.id}
                        title={b.title}
                        character={b.character}
                        cover={b.coverImageUrl}
                        status={b.commissionStatus}
                        likes={b.likesCount}
                      />
                    ))}
                  </div>
                ) : (
                  cards.map((b: any) => (
                    <Link key={b.id || b.title} href={`/build/${b.id || "jinx"}`} className="flex items-center gap-3 py-3 border-b border-line no-underline text-paper">
                      <div className="w-12 h-14 overflow-hidden">
                        <SmartImage src={b.coverImageUrl} alt={b.title} fallback={b.title} />
                      </div>
                      <div className="flex-1">
                        <div>{b.character || b.title}</div>
                        <div className="font-mono text-[11px] text-ink-45">{b.franchise} · {b.year}</div>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}

            {tab === "orders" && (
              <div className="flex flex-col gap-2">
                {historyOrders.length === 0 ? (
                  <EmptyState title="Пока нет выполненных или отменённых заказов" />
                ) : (
                  historyOrders.map((o) => (
                    <Frame key={o.id} className="p-4 bg-stage flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display font-bold">{o.title || o.character || "Заказ"}</div>
                        {o.character && o.character !== o.title && (
                          <div className="font-mono text-[11px] text-ink-45">{o.character}</div>
                        )}
                      </div>
                      <span className="font-mono text-[11px] uppercase text-magenta shrink-0">
                        {o.status === "cancelled" ? "Отменён" : o.status === "shipped" ? "Отправлено" : "Готово"}
                      </span>
                    </Frame>
                  ))
                )}
              </div>
            )}

            {tab === "stories" && (
              <div>
                <StoryRingStrip
                  stories={activeStories}
                  isOwner={isOwner}
                  onOpen={(i) => setStoryIndex(i)}
                  onAdd={() => {
                    setCreateKind("story");
                    setCreateOpen(true);
                  }}
                />
                {activeStories.length === 0 && !isOwner && <EmptyState title="Пока нет историй" />}
              </div>
            )}

            {tab === "about" && (
              <div className="text-[14px] text-ink-70 leading-relaxed space-y-3">
                {bio && <p className="whitespace-pre-wrap">{bio}</p>}
                {p?.experienceYears != null && p.experienceYears !== "" && <p>Опыт: {p.experienceYears} лет</p>}
                {(() => {
                  try {
                    const skills = p?.specializationsJson ? JSON.parse(p.specializationsJson) : [];
                    return Array.isArray(skills) && skills.length ? <p>Навыки: {skills.join(", ")}</p> : null;
                  } catch {
                    return null;
                  }
                })()}
                {(() => {
                  try {
                    const mats = p?.materialsJson ? JSON.parse(p.materialsJson) : [];
                    return Array.isArray(mats) && mats.length ? <p>Материалы: {mats.join(", ")}</p> : null;
                  } catch {
                    return null;
                  }
                })()}
                {!bio && !p?.experienceYears && <p className="text-ink-45">Пока ничего не указано.</p>}
              </div>
            )}

            {tab === "publications" && (
              <>
                <div className="flex items-center mb-4">
                  <span className="text-[13px] text-ink-45">{posts.length} публикаций</span>
                  {isOwner && (
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setCreateKind("post");
                        setCreateOpen(true);
                      }}
                    >
                      + Публикация
                    </Button>
                  )}
                </div>
                <PublicationGrid posts={posts} onSelect={setSelectedPost} />
              </>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] uppercase text-ink-45 mb-3 flex items-center gap-2">
                <CalendarDays size={14} /> Конвенты
              </div>
              {events.length === 0 && <p className="text-[12px] text-ink-45">Нет ближайших конвентов</p>}
              {events.map((e: any) => (
                <Link key={e.name} href={`/profile/${username}/events`} className="flex gap-3 py-2 border-b border-line no-underline text-paper">
                  <div className="font-mono text-[11px] text-magenta w-12 shrink-0">
                    {String(e.date).slice(8, 10)} {["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"][Number(String(e.date).slice(5, 7)) - 1]}
                  </div>
                  <div>
                    <div className="text-[13px]">{e.name}</div>
                    <div className="text-[11px] text-ink-45">{e.city}</div>
                  </div>
                </Link>
              ))}
              <Link href={`/profile/${username}/events`} className="block mt-3 text-[12px] text-magenta no-underline">
                Смотреть все мероприятия →
              </Link>
            </Frame>
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] uppercase text-ink-45 mb-3">Статистика</div>
              {[
                { icon: GalleryVerticalEnd, n: stats.builds, l: "Билдов" },
                { icon: Users, n: stats.followers, l: "Подписчиков", open: "followers" as const },
                { icon: UserPlus, n: stats.following, l: "Подписок", open: "following" as const },
                { icon: Heart, n: formatCount(stats.likes), l: "Лайков" },
                { icon: CheckCircle, n: stats.orders ?? 0, l: "Заказов" },
              ].map((s) => (
                <button
                  key={s.l}
                  type="button"
                  className="flex items-center gap-2 py-1.5 text-[13px] w-full bg-transparent border-0 text-left text-paper"
                  onClick={() => {
                    if (!("open" in s) || !s.open) return;
                    setListOpen(s.open);
                    const fn = s.open === "followers" ? users.followers : users.following;
                    fn(username).then((d) => setListUsers(d.users || [])).catch(() => setListUsers([]));
                  }}
                >
                  <s.icon size={14} className="text-magenta" /> {s.n} <span className="text-ink-45">{s.l}</span>
                </button>
              ))}
            </Frame>
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] uppercase text-ink-45 mb-2">
                {p?.availability === "closed" ? "Закрыт для заказов" : p?.availability === "limited" ? "Ограниченно принимает заказы" : "Открыт для заказов"}
              </div>
              <div className="text-[13px] text-ink-70 space-y-1">
                {p?.commissionComplexity && <p>Сложность: {p.commissionComplexity}</p>}
                {p?.commissionTypes && <p>Типы: {p.commissionTypes}</p>}
                <p>
                  Сроки:{" "}
                  {p?.commissionDuration || (orderMeta.deadlineCount ? "по завершённым заказам" : "неизвестно")}
                </p>
                {orderMeta.avgBudget != null ? (
                  <p>Средний чек: {formatSum(orderMeta.avgBudget)}</p>
                ) : (
                  <p>Средний чек: неизвестно</p>
                )}
              </div>
              <Link href={`/profile/${username}/commissions`} className="block mt-3 text-[12px] text-magenta no-underline">
                Подробнее о заказах →
              </Link>
            </Frame>
          </aside>
        </div>
      </div>

      {isOwner ? null : (
        <div className="md:hidden sticky bottom-0 p-3 bg-ink border-t border-line">
          <Button className="w-full" onClick={() => setCommissionOpen(true)}>Запросить коммишен</Button>
        </div>
      )}

      {commissionOpen && (
        <Modal title="Заявка на коммишен" onClose={() => setCommissionOpen(false)}>
          {(() => {
            const list = profile?.commissions || [];
            const mine = list.find((c: any) => c.status === "open") || list[0];
            if (!mine) {
              return <p className="text-[13px] text-ink-45">У продавца нет открытой комиссии.</p>;
            }
            return (
              <CommissionRequestForm
                commissionId={mine.id}
                onClose={() => setCommissionOpen(false)}
              />
            );
          })()}
        </Modal>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-ink/90 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
          }}
        >
          <Frame className="w-full max-w-[640px] aspect-[4/5] overflow-hidden">
            <SmartImage alt="" fallback="build" />
          </Frame>
        </div>
      )}

      {selectedPost && (
        <PostLightbox
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onCommentsCountChange={(n) => {
            setSelectedPost((p) => (p ? { ...p, commentsCount: n } : p));
            setPosts((list) => list.map((p) => (p.id === selectedPost.id ? { ...p, commentsCount: n } : p)));
          }}
        />
      )}

      {storyIndex !== null && (
        <StoryViewer
          stories={activeStories}
          startIndex={storyIndex}
          username={username}
          onClose={() => setStoryIndex(null)}
        />
      )}

      {buildOpen && isOwner && (
        <CreateBuildModal
          onClose={() => setBuildOpen(false)}
          onSaved={() => {
            users.get(username).then((d) => setApiBuilds(d.builds));
          }}
        />
      )}

      {createOpen && isOwner && (
        <CreatePublicationModal
          kind={createKind}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (payload) => {
            try {
              const res = await publicationsApi.create({
                caption: payload.caption,
                mediaUrls: payload.mediaUrls,
                tags: payload.tags,
                mentions: payload.mentions.map((m) => ({
                  username: m.username,
                  displayName: m.displayName,
                  type: m.type,
                })),
                kind: payload.kind,
              });
              const pub = normalizePublication(res.publication);
              if (payload.kind === "story") {
                setActiveStories((s) => [...s, pub]);
              } else {
                setPosts((p) => [pub, ...p]);
              }
              toast(payload.kind === "story" ? "История опубликована" : "Публикация создана");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Не удалось опубликовать", true);
            }
          }}
        />
      )}

      {listOpen && (
        <Modal title={listOpen === "followers" ? "Подписчики" : "Подписки"} onClose={() => setListOpen(null)}>
          {listUsers.length === 0 && <p className="text-[13px] text-ink-45">Список пуст</p>}
          <div className="flex flex-col">
            {listUsers.map((u: any) => (
              <Link
                key={u.id || u.username}
                href={`/profile/${u.username}`}
                className="flex items-center gap-3 py-2 no-underline text-paper border-b border-line"
                onClick={() => setListOpen(null)}
              >
                <span className="w-8 h-8 overflow-hidden border border-line">
                  <SmartImage src={u.avatarUrl} alt={u.username} fallback={u.username} />
                </span>
                <span>{u.displayName || u.username}</span>
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
