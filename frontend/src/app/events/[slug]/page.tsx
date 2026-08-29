"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, MessagesSquare } from "lucide-react";
import { partners, type PartnerEventDetail } from "@/lib/api";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Frame } from "@/components/Frame";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [event, setEvent] = useState<PartnerEventDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partners
      .event(slug)
      .then((r) => setEvent(r.event))
      .catch((e) => setError(e instanceof Error ? e.message : "Не найдено"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto" role="status" aria-label="Загрузка">
        <Skeleton className="aspect-[21/9] w-full rounded-none mb-6" />
        <Skeleton className="h-8 w-2/3 mb-3" />
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (error || !event) {
    return (
      <div className="p-8">
        <EmptyState title="Событие не найдено" action={<Button href="/explore">На главную</Button>} />
      </div>
    );
  }

  const channelHref = event.channelId ? `/messages?tab=channels&c=${event.channelId}` : null;

  return (
    <div className="pt-11 pb-16">
      <div className="relative h-[220px] sm:h-[300px] bg-stage border-b border-line">
        {event.coverUrl && <SmartImage src={event.coverUrl} alt="" className="w-full h-full object-cover opacity-50" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
        <div className="absolute bottom-0 max-w-[900px] mx-auto px-5 sm:px-8 py-8 left-0 right-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-magenta">Мероприятие</span>
          <h1 className="font-display font-extrabold text-[clamp(26px,4vw,44px)] mt-2">{event.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-ink-70">
            {event.city && (
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {event.city}
              </span>
            )}
            {event.startsAt && (
              <span className="flex items-center gap-1">
                <CalendarDays size={14} />
                {new Date(event.startsAt).toLocaleDateString("ru-RU")}
                {event.endsAt && ` — ${new Date(event.endsAt).toLocaleDateString("ru-RU")}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-8 space-y-8">
        <div className="flex flex-wrap gap-3">
          {channelHref && (
            <Button href={channelHref}>
              <MessagesSquare size={16} className="mr-2" />
              Перейти в канал
            </Button>
          )}
          {event.partner?.slug && (
            <Button href={`/partners/${event.partner.slug}`} variant="outline">
              О партнёре
            </Button>
          )}
        </div>

        {Array.isArray(event.program) && event.program.length > 0 && (
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-3">Программа</h2>
            <Frame className="p-4 bg-stage/50">
              <ul className="space-y-2 text-[14px] text-ink-70">
                {event.program.map((item, i) => (
                  <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            </Frame>
          </section>
        )}

        {event.links && event.links.length > 0 && (
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta mb-3">Ссылки</h2>
            <div className="flex flex-wrap gap-3">
              {event.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-magenta text-[13px]"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="text-[12px] text-ink-45">
          Организатор:{" "}
          <Link href={`/partners/${event.partner.slug}`} className="text-magenta">
            {event.partner.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
