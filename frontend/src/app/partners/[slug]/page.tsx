"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { partners, type PartnerPublic } from "@/lib/api";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLocale } from "@/lib/LocaleContext";

export default function PartnerVitrinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { formatSum } = useLocale();
  const [partner, setPartner] = useState<PartnerPublic | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partners
      .get(slug)
      .then((r) => setPartner(r.partner))
      .catch((e) => setError(e instanceof Error ? e.message : "Не найдено"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="p-8 font-mono text-ink-45">Загрузка…</div>;
  if (error || !partner) {
    return (
      <div className="p-8">
        <EmptyState title="Партнёр не найден" action={<Button href="/partners">К партнёрам</Button>} />
      </div>
    );
  }

  return (
    <div className="pt-11 pb-16">
      <div className="relative h-[200px] sm:h-[280px] bg-stage border-b border-line overflow-hidden">
        {partner.coverUrl ? (
          <SmartImage src={partner.coverUrl} alt="" className="w-full h-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-[1200px] mx-auto px-5 sm:px-8 py-6 flex items-end gap-4">
          {partner.logoUrl && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 border border-line bg-stage shrink-0 overflow-hidden">
              <SmartImage src={partner.logoUrl} alt={partner.name} />
            </div>
          )}
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-magenta">Партнёр · {partner.type}</span>
            <h1 className="font-display font-extrabold text-[clamp(24px,4vw,40px)]">{partner.name}</h1>
            {partner.city && (
              <div className="flex items-center gap-1 text-ink-70 text-[13px] mt-1">
                <MapPin size={14} /> {partner.city}
                {partner.country ? `, ${partner.country}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
        <div className="min-w-0 space-y-10">
          {partner.description && (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-3">О партнёре</h2>
              <p className="text-[15px] text-ink-70 leading-relaxed whitespace-pre-wrap">{partner.description}</p>
            </section>
          )}

          {partner.makers && partner.makers.length > 0 && (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-4">Мейкеры</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {partner.makers.map((m) => (
                  <Link key={m.id} href={`/profile/${m.username}`} className="no-underline text-paper">
                    <Frame hover className="flex items-center gap-3 p-3 bg-stage/50">
                      <div className="w-12 h-12 shrink-0 overflow-hidden border border-line">
                        <SmartImage src={m.avatarUrl} alt={m.username || ""} fallback={m.username || "?"} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold truncate">{m.username}</div>
                        {m.badgeLabel && (
                          <div className="font-mono text-[10px] text-magenta mt-0.5 truncate">{m.badgeLabel}</div>
                        )}
                      </div>
                    </Frame>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {partner.rentals && partner.rentals.length > 0 && (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-4">Аренда</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {partner.rentals.map((r) => (
                  <Frame key={r.id} className="overflow-hidden bg-stage/50">
                    <div className="aspect-[4/3] bg-ink/40">
                      <SmartImage src={r.photos?.[0]} alt={r.title} fallback={r.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <div className="font-display font-bold">{r.title}</div>
                      {r.franchise && <div className="font-mono text-[10px] text-ink-45 uppercase mt-1">{r.franchise}</div>}
                      {r.size && <div className="text-[12px] text-ink-70 mt-1">Размер: {r.size}</div>}
                      {r.price != null && (
                        <div className="font-mono text-[12px] text-magenta mt-2">{formatSum(r.price)}</div>
                      )}
                    </div>
                  </Frame>
                ))}
              </div>
            </section>
          )}

          {partner.events && partner.events.length > 0 && (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-4">Мероприятия</h2>
              <div className="flex flex-col gap-3">
                {partner.events.map((ev) => (
                  <Link key={ev.id} href={`/events/${ev.slug}`} className="no-underline text-paper">
                    <Frame hover className="p-4 flex gap-4 bg-stage/50">
                      {ev.coverUrl && (
                        <div className="w-20 h-20 shrink-0 overflow-hidden">
                          <SmartImage src={ev.coverUrl} alt={ev.title} />
                        </div>
                      )}
                      <div>
                        <div className="font-display font-bold">{ev.title}</div>
                        <div className="text-[13px] text-ink-70 mt-1">
                          {ev.city}
                          {ev.startsAt && ` · ${new Date(ev.startsAt).toLocaleDateString("ru-RU")}`}
                        </div>
                      </div>
                    </Frame>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {partner.websiteUrl && (
            <a
              href={partner.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-magenta text-[13px] no-underline hover:underline"
            >
              Сайт <ExternalLink size={14} />
            </a>
          )}
          <Button href="/partners" variant="outline" className="w-full">
            Стать партнёром
          </Button>
        </aside>
      </div>
    </div>
  );
}
