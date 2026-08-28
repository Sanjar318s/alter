"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MarketBuildCard, type MarketBuildCardItem } from "@/components/builds/MarketBuildCard";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useLocale } from "@/lib/LocaleContext";
import { useAuth } from "@/lib/AuthContext";
import { explore } from "@/lib/api";

const SHELL = "max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10";

export default function MarketPage() {
  const { t, formatSum } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState<MarketBuildCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await explore.list({ sort: "popular", limit: 12 });
        if (stop) return;
        setItems(
          (res.data || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            character: d.character,
            franchise: d.franchise,
            author: d.author,
            authorAvatar: d.authorAvatar,
            coverImageUrl: d.coverImageUrl,
            likesCount: d.likesCount ?? 0,
            commentsCount: d.commentsCount ?? 0,
            price: d.price,
            isVerified: d.isVerified,
          }))
        );
      } catch {
        if (!stop) setItems([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  const orderHref = user?.platformRole === "seller" ? "/studio" : user ? "/explore" : "/register";

  return (
    <div className="min-h-full">
      <section className="market-hero hero-wash border-b border-line py-14 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="market-hero-art" aria-hidden />
        <div className={SHELL}>
          <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div className="max-w-[640px] market-hero-copy">
              <p className="font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.18em] text-magenta">
                {t("marketEyebrow")}
              </p>
              <h1 className="font-display font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.1] mt-4 text-paper">
                {t("marketTitle")}
              </h1>
              <p className="text-[15px] md:text-[17px] text-ink-70 mt-5 leading-relaxed max-w-[520px]">
                {t("marketLead")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Button href="/explore">{t("watchHow")}</Button>
                <Button href={orderHref} variant="outline">
                  {t("marketOrderCta")}
                </Button>
              </div>
            </div>
            <div className="market-hero-visual hidden lg:flex justify-center items-center">
              <BrandLogo
                href="/market"
                showText={false}
                size={300}
                unoptimized
                imageClassName="market-hero-logo"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14 border-b border-line">
        <div className={SHELL}>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display font-extrabold text-[clamp(22px,3vw,30px)]">{t("marketPopular")}</h2>
              <p className="text-[14px] text-ink-70 mt-2 max-w-[560px]">{t("marketPopularLead")}</p>
            </div>
            <Link
              href="/explore"
              className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-magenta no-underline hover:underline shrink-0"
            >
              {t("marketAllWorks")} <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="font-mono text-[13px] text-ink-45 py-8">{t("loading")}</div>
          ) : items.length === 0 ? (
            <div className="border border-line border-dashed p-8 text-center text-ink-70 text-[14px]">
              {t("marketEmpty")}
              <div className="mt-4">
                <Button href="/explore" variant="outline" size="sm">
                  {t("watchHow")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {items.map((item) => (
                <div key={item.id} className="w-[min(72vw,220px)] shrink-0 snap-start">
                  <MarketBuildCard item={item} formatSum={formatSum} moreLabel={t("more")} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 sm:hidden">
            <Button href="/explore" variant="outline" className="w-full">
              {t("marketAllWorks")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
