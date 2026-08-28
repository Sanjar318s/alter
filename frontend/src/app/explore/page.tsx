"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Hint } from "@/components/ui/Hint";
import { MarketBuildCard } from "@/components/builds/MarketBuildCard";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/lib/LocaleContext";
import { SmartImage } from "@/components/media/SmartImage";
import { builds as buildsApi, explore, placements as placementsApi } from "@/lib/api";
import { PartnerCard } from "@/components/marketing/PartnerCard";
import type { AdPlacementResponse } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const PAGE = 24;

const FALLBACK_CATEGORIES: { id: string; name: string; count: number }[] = [
  { id: "all", name: "Все категории", count: 0 },
  { id: "genshin-impact", name: "Genshin Impact", count: 0 },
  { id: "honkai-star-rail", name: "Honkai: Star Rail", count: 0 },
  { id: "nier-automata", name: "Nier: Automata", count: 0 },
  { id: "league-of-legends", name: "League of Legends", count: 0 },
  { id: "vocaloid", name: "Vocaloid", count: 0 },
  { id: "chainsaw-man", name: "Chainsaw Man", count: 0 },
  { id: "demon-slayer", name: "Demon Slayer", count: 0 },
  { id: "jujutsu-kaisen", name: "Jujutsu Kaisen", count: 0 },
  { id: "overwatch", name: "Overwatch", count: 0 },
  { id: "other", name: "Другие", count: 0 },
];

type ExploreCard = {
  id: string;
  title: string;
  character?: string;
  franchise?: string;
  author?: string;
  authorAvatar?: string | null;
  coverImageUrl?: string | null;
  status?: string;
  likesCount: number;
  commentsCount: number;
  year?: number;
  price?: number;
  isLiked?: boolean;
  isVerified?: boolean;
};

export default function ExplorePage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<div className="pt-11 px-6 text-ink-45 font-mono text-sm">{t("loading")}</div>}>
      <ExploreClient />
    </Suspense>
  );
}

function ExploreClient() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const { t, formatSum } = useLocale();
  const CHIPS = [
    { id: "", label: t("all") },
    { id: "cosplayer", label: t("cosplayer") },
    { id: "maker", label: t("maker") },
    { id: "photographer", label: t("photographer") },
    { id: "open", label: t("openCommissions") },
  ] as const;
  const SORTS = [
    { id: "new", label: t("newest") },
    { id: "popular", label: t("popular") },
    { id: "likes", label: t("likes") },
    { id: "comments", label: t("comments") },
    { id: "price_asc", label: t("priceAsc") },
    { id: "price_desc", label: t("priceDesc") },
  ];

  const q = params.get("q") || "";
  const role = params.get("role") || "";
  const category = params.get("category") || "all";
  const commission = params.get("commission") || "";
  const sort = params.get("sort") || "new";
  const view = params.get("view") || "grid";
  const priceMin = params.get("priceMin") || "";
  const priceMax = params.get("priceMax") || "";

  const [draftQ, setDraftQ] = useState(q);
  const [items, setItems] = useState<ExploreCard[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [total, setTotal] = useState(0);
  const [cats, setCats] = useState<{ id: string; name: string; slug?: string; count: number }[]>([]);
  const [statuses, setStatuses] = useState({ open: 0, waitlist: 0, closed: 0, none: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState("all");
  const [draftCommissionOpen, setDraftCommissionOpen] = useState(false);
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [feedSponsor, setFeedSponsor] = useState<AdPlacementResponse["placement"]>(null);
  const [sidebarEvent, setSidebarEvent] = useState<AdPlacementResponse["placement"]>(null);

  useEffect(() => {
    placementsApi.get("explore_feed_sponsor").then((r) => setFeedSponsor(r.placement)).catch(() => {});
    placementsApi.get("explore_sidebar_event").then((r) => setSidebarEvent(r.placement)).catch(() => {});
  }, []);

  useEffect(() => {
    if (params.get("focus") === "1") searchRef.current?.focus();
  }, [params]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (draftQ !== q) setParam({ q: draftQ || undefined });
    }, 400);
    return () => clearTimeout(t);
  }, [draftQ]);

  function setParam(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    });
    sp.delete("focus");
    router.replace(`/explore?${sp.toString()}`, { scroll: false });
  }

  async function load(reset: boolean) {
    setLoading(true);
    setError("");
    try {
      const res = await explore.list({
        q,
        role: role === "open" ? "" : role,
        category: category === "all" ? "" : category,
        commission: role === "open" ? "open" : commission,
        sort,
        priceMin,
        priceMax,
        cursor: reset ? 0 : cursor || 0,
        limit: PAGE,
      });
      const mapped: ExploreCard[] = res.data.map((d) => ({
        id: d.id,
        title: d.title,
        character: d.character,
        franchise: d.franchise,
        author: d.author,
        authorAvatar: d.authorAvatar,
        coverImageUrl: d.coverImageUrl,
        status: d.status,
        likesCount: d.likesCount,
        commentsCount: d.commentsCount,
        year: d.year,
        price: d.price,
        isLiked: d.isLiked,
        isVerified: d.isVerified,
      }));
      setItems(reset ? mapped : [...items, ...mapped]);
      setCursor(res.nextCursor);
      setTotal(res.total);
      setCats(res.categories);
      setStatuses(res.statuses as typeof statuses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
      if (reset) setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike(id: string, current: boolean) {
    setLiked((s) => ({ ...s, [id]: !current }));
    try {
      if (current) await buildsApi.unlike(id);
      else await buildsApi.like(id);
    } catch {
      setLiked((s) => ({ ...s, [id]: current }));
      toast("Не удалось сохранить лайк", true);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, category, commission, sort, priceMin, priceMax]);

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftCategory(category || "all");
    setDraftCommissionOpen(commission === "open");
    setDraftPriceMin(priceMin);
    setDraftPriceMax(priceMax);
  }, [filtersOpen, category, commission, priceMin, priceMax]);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  function applyMobileFilters() {
    setParam({
      category: draftCategory === "all" ? undefined : draftCategory,
      commission: draftCommissionOpen ? "open" : undefined,
      priceMin: draftPriceMin.trim() || undefined,
      priceMax: draftPriceMax.trim() || undefined,
      role: draftCommissionOpen ? undefined : role || undefined,
    });
    setFiltersOpen(false);
  }

  function resetMobileFilters() {
    setDraftCategory("all");
    setDraftCommissionOpen(false);
    setDraftPriceMin("");
    setDraftPriceMax("");
  }

  const displayCats = cats.length > 0 ? cats : FALLBACK_CATEGORIES;
  const commissionOpenLive = commission === "open" || role === "open";

  function renderFiltersPanel(opts: {
    mode: "live" | "draft";
    categoryValue: string;
    onCategoryChange: (id: string) => void;
    commissionOpen: boolean;
    onCommissionOpenChange: (open: boolean) => void;
    priceMinValue: string;
    priceMaxValue: string;
    onPriceMinChange: (value: string) => void;
    onPriceMaxChange: (value: string) => void;
  }) {
    const {
      mode,
      categoryValue,
      onCategoryChange,
      commissionOpen,
      onCommissionOpenChange,
      priceMinValue,
      priceMaxValue,
      onPriceMinChange,
      onPriceMaxChange,
    } = opts;

    return (
      <>
        <div className="explore-filter-section">
          <div className="explore-filter-heading">Категории</div>
          <div className="flex flex-col">
            {displayCats.map((c) => {
              const active = categoryValue === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCategoryChange(c.id)}
                  className={cn(
                    "explore-filter-category",
                    active && "explore-filter-category--active"
                  )}
                >
                  <span>{c.name}</span>
                  {c.count > 0 && (
                    <span className="font-mono text-[11px] text-ink-45 tabular-nums">{c.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="explore-filter-section">
          <div className="explore-filter-heading">Можно заказать</div>
          <label className="explore-filter-checkbox-row">
            <span className="flex items-center gap-2.5 min-w-0">
              <input
                type="checkbox"
                className="explore-filter-checkbox"
                checked={commissionOpen}
                onChange={(e) => onCommissionOpenChange(e.target.checked)}
              />
              <span className={cn("text-[14px]", commissionOpen ? "text-magenta" : "text-paper")}>
                {t("openCommissions")}
              </span>
            </span>
            {statuses.open > 0 && (
              <span className="font-mono text-[11px] text-ink-45 tabular-nums">{statuses.open}</span>
            )}
          </label>
        </div>

        <div className="explore-filter-section">
          <div className="explore-filter-heading">Цена (сум)</div>
          <div className="flex gap-2">
            {mode === "draft" ? (
              <>
                <input
                  className="explore-filter-price-input"
                  placeholder={t("from")}
                  value={priceMinValue}
                  inputMode="numeric"
                  onChange={(e) => onPriceMinChange(e.target.value)}
                />
                <input
                  className="explore-filter-price-input"
                  placeholder={t("to")}
                  value={priceMaxValue}
                  inputMode="numeric"
                  onChange={(e) => onPriceMaxChange(e.target.value)}
                />
              </>
            ) : (
              <>
                <input
                  key={`min-${priceMinValue}`}
                  className="explore-filter-price-input"
                  placeholder={t("from")}
                  defaultValue={priceMinValue}
                  inputMode="numeric"
                  onBlur={(e) => onPriceMinChange(e.target.value)}
                />
                <input
                  key={`max-${priceMaxValue}`}
                  className="explore-filter-price-input"
                  placeholder={t("to")}
                  defaultValue={priceMaxValue}
                  inputMode="numeric"
                  onBlur={(e) => onPriceMaxChange(e.target.value)}
                />
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  const sidebarFilters = renderFiltersPanel({
    mode: "live",
    categoryValue: category || "all",
    onCategoryChange: (id) => setParam({ category: id === "all" ? undefined : id }),
    commissionOpen: commissionOpenLive,
    onCommissionOpenChange: (open) =>
      setParam({ commission: open ? "open" : undefined, role: open ? undefined : role || undefined }),
    priceMinValue: priceMin,
    priceMaxValue: priceMax,
    onPriceMinChange: (value) => setParam({ priceMin: value || undefined }),
    onPriceMaxChange: (value) => setParam({ priceMax: value || undefined }),
  });

  const Sidebar = (
    <aside className="hidden lg:block w-[240px] shrink-0">
      <div className="explore-sidebar-panel sticky top-[88px]">
        {sidebarFilters}
        {sidebarEvent && (
          <div className="mt-6 pt-6 border-t border-line">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45 mb-2">Партнёр</div>
            <PartnerCard placement={sidebarEvent} compact />
          </div>
        )}
      </div>
    </aside>
  );

  const filtersSheet =
    filtersOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] bg-ink/80 flex items-end lg:hidden"
            onClick={() => setFiltersOpen(false)}
            role="presentation"
          >
            <div
              className="explore-filters-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={t("filters")}
            >
              <div className="explore-filters-sheet-handle" aria-hidden />
              <div className="explore-filters-sheet-header">
                <div className="font-display font-extrabold text-[18px]">{t("filters")}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="explore-filters-reset"
                    onClick={resetMobileFilters}
                  >
                    Сбросить
                  </button>
                  <IconButton label="Закрыть" onClick={() => setFiltersOpen(false)}>
                    <X size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="explore-filters-sheet-body">
                {renderFiltersPanel({
                  mode: "draft",
                  categoryValue: draftCategory,
                  onCategoryChange: setDraftCategory,
                  commissionOpen: draftCommissionOpen,
                  onCommissionOpenChange: setDraftCommissionOpen,
                  priceMinValue: draftPriceMin,
                  priceMaxValue: draftPriceMax,
                  onPriceMinChange: setDraftPriceMin,
                  onPriceMaxChange: setDraftPriceMax,
                })}
              </div>
              <div className="explore-filters-sheet-footer">
                <Button className="w-full rounded-[8px] font-semibold" onClick={applyMobileFilters}>
                  Применить
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="min-h-full">
      <section className="explore-hero hero-wash border-b border-line relative">
        <div className="pt-11 px-4 sm:px-6 lg:px-8 relative z-[1]">
          <div className="max-w-[1440px] mx-auto py-8 md:py-10">
            <Link
              href="/market"
              className="inline-flex items-center gap-2 text-[13px] text-ink-45 no-underline hover:text-paper"
            >
              <ArrowLeft size={16} /> {t("explore")}
            </Link>
            <div className="mt-5 max-w-[720px]">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-magenta">
                {t("explore")}
              </span>
              <h1 className="font-display font-extrabold text-[clamp(24px,3.5vw,38px)] leading-tight mt-2">
                {t("exploreTitle")}
              </h1>
              <p className="text-[14px] md:text-[15px] text-ink-70 mt-3 leading-relaxed">
                {t("exploreLead")}{" "}
                <Hint term={t("buildTerm")} text={t("buildHint")} />
              </p>
            </div>
            <div className="relative mt-6 max-w-[760px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-45 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setParam({ q: draftQ || undefined });
                  if (e.key === "Escape") {
                    setDraftQ("");
                    setParam({ q: undefined });
                  }
                }}
                placeholder={t("exploreSearch")}
                className="explore-search-input"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 pb-20 min-w-0 max-w-full overflow-x-clip">
      <div className="max-w-[1440px] mx-auto min-w-0 pt-6">
        <div className="flex items-center gap-2 mb-5 lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="w-full">
            <SlidersHorizontal size={16} className="mr-2" />
            {t("filters")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8 p-3 border border-line rounded-[10px] bg-stage/30">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (!c.id) router.replace("/explore");
                else if (c.id === "open") setParam({ role: undefined, commission: "open" });
                else setParam({ role: c.id });
              }}
              className={cn(
                "font-mono text-[11px] px-3.5 py-2 border tracking-[0.06em] uppercase cursor-pointer rounded-[6px] transition-colors",
                (!c.id && !role && !commission) ||
                  (c.id === "open" && commission === "open") ||
                  role === c.id
                  ? "border-magenta/60 text-magenta bg-magenta/10"
                  : "border-line text-ink-45 hover:text-paper hover:border-ink-70"
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <select
              className="field-box py-2 text-[12px] w-full sm:w-[160px] min-w-0"
              value={sort}
              onChange={(e) => setParam({ sort: e.target.value })}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t("sort")}: {s.label}
                </option>
              ))}
            </select>
            <IconButton label={t("grid")} onClick={() => setParam({ view: "grid" })}>
              <LayoutGrid size={18} className={view !== "list" ? "text-magenta" : ""} />
            </IconButton>
            <IconButton label={t("list")} onClick={() => setParam({ view: "list" })}>
              <List size={18} className={view === "list" ? "text-magenta" : ""} />
            </IconButton>
          </div>
        </div>

        <div className="flex gap-6 lg:gap-8 min-w-0">
          {Sidebar}
          <div className="flex-1 min-w-0">
            {error && (
              <EmptyState title="Не удалось загрузить" action={<Button onClick={() => load(true)}>Повторить</Button>} />
            )}
            {!loading && items.length === 0 && (
              <EmptyState
                title="Ничего не найдено"
                description="Сбрось фильтры или попробуй другое имя персонажа."
                action={
                  <Button variant="outline" size="sm" onClick={() => router.replace("/explore")}>
                    Сбросить фильтры
                  </Button>
                }
              />
            )}
            {view === "list" ? (
              <div className="flex flex-col min-w-0">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/build/${item.id}`}
                    className="flex items-center gap-3 sm:gap-4 py-3 border-b border-line no-underline text-paper hover:bg-stage/50 min-w-0"
                  >
                    <div className="w-12 h-[60px] sm:w-14 sm:h-[70px] shrink-0 overflow-hidden relative">
                      <SmartImage
                        src={item.coverImageUrl}
                        alt={
                          item.author
                            ? `${item.character || item.title} — косплей от ${item.author}`
                            : item.character || item.title
                        }
                        fallback={item.title}
                      />
                    </div>
                    <div className="flex-1 min-w-0 md:hidden">
                      <div className="font-display font-bold truncate">{item.character}</div>
                      <div className="font-mono text-[11px] text-ink-45 truncate">{item.franchise}</div>
                      <div className="text-[12px] text-ink-70 truncate mt-0.5">{item.author}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 font-mono text-[11px]">
                        <span>{formatCount(item.likesCount)} ♥</span>
                        <span>{item.commentsCount} 💬</span>
                        <span>{item.price ? formatSum(item.price) : "—"}</span>
                      </div>
                    </div>
                    <div className="hidden md:flex flex-1 items-center gap-4 min-w-0">
                      <div className="font-display font-bold w-32 lg:w-40 truncate shrink-0">{item.character}</div>
                      <div className="font-mono text-[11px] text-ink-45 flex-1 min-w-0 truncate">{item.franchise}</div>
                      <div className="text-[13px] w-24 truncate shrink-0 hidden lg:block">{item.author}</div>
                      <div className="font-mono text-[11px] w-16 shrink-0">{formatCount(item.likesCount)}</div>
                      <div className="font-mono text-[11px] w-12 shrink-0">{item.commentsCount}</div>
                      <div className="font-mono text-[11px] w-24 shrink-0">{item.price ? formatSum(item.price) : "—"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {items.map((item, index) => {
                  const isLiked = liked[item.id] ?? item.isLiked;
                  const showSponsor = feedSponsor && index > 0 && index % 10 === 0;
                  return (
                    <Fragment key={item.id}>
                      {showSponsor && (
                        <div key={`ad-${index}`} className="col-span-2 sm:col-span-2 md:col-span-2 xl:col-span-2">
                          <PartnerCard placement={feedSponsor} compact />
                        </div>
                      )}
                      <div key={item.id} className="group relative">
                        <MarketBuildCard
                          item={item}
                          isLiked={liked[item.id] ?? item.isLiked}
                          likeCount={
                            item.likesCount +
                            ((liked[item.id] ?? item.isLiked) && !item.isLiked ? 1 : 0)
                          }
                          onToggleLike={toggleLike}
                          formatSum={formatSum}
                          moreLabel={t("more")}
                        />
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
            {cursor != null && items.length > 0 && (
              <div className="flex justify-center mt-10">
                <Button variant="outline" onClick={() => load(false)} disabled={loading}>
                  {loading ? "Загрузка…" : "Загрузить ещё"}
                </Button>
              </div>
            )}
            {total > 0 && (
              <div className="font-mono text-[11px] text-ink-45 text-center mt-4">{total} работ</div>
            )}
          </div>
        </div>
      </div>
      </div>

      {filtersSheet}
    </div>
  );
}
