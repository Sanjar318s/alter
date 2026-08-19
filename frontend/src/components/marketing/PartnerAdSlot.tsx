"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/LocaleContext";
import { placements as placementsApi } from "@/lib/api";
import { PartnerCard } from "@/components/marketing/PartnerCard";
import type { AdPlacementResponse } from "@/lib/api";

export function PartnerAdSlot({ className }: { className?: string }) {
  const { t } = useLocale();
  const [live, setLive] = useState<AdPlacementResponse["placement"]>(null);

  useEffect(() => {
    placementsApi.get("home_hero_partner").then((r) => setLive(r.placement)).catch(() => setLive(null));
  }, []);

  if (live) {
    return (
      <section className={`border-b border-line py-10 lg:py-14 ${className ?? ""}`}>
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10">
          <PartnerCard placement={live} />
        </div>
      </section>
    );
  }

  return (
    <section className={`border-b border-line py-10 lg:py-14 ${className ?? ""}`}>
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden border border-dashed border-magenta/45 bg-gradient-to-br from-stage/80 via-ink/50 to-amber/[0.04]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(229,72,122,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(229,72,122,0.04)_1px,transparent_1px)] bg-[size:28px_28px]"
          />
          <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 lg:gap-10 p-6 sm:p-8 lg:p-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-magenta border border-magenta/50 bg-magenta/[0.08] px-2.5 py-1">
                <Megaphone size={12} strokeWidth={2} aria-hidden />
                {t("partnerAdEyebrow")}
              </div>
              <h2 className="font-display font-extrabold text-[clamp(22px,3vw,32px)] leading-[1.12] mt-5 max-w-[520px]">
                {t("partnerAdTitle")}
              </h2>
              <p className="text-[14px] text-ink-70 mt-3 leading-relaxed max-w-[480px]">{t("partnerAdLead")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/partners">{t("becomePartner")}</Button>
                <Link href="/partners#apply" className="text-[13px] text-ink-70 hover:text-paper self-center">
                  Оставить заявку
                </Link>
              </div>
            </div>
            <div
              aria-hidden
              className="hidden lg:flex flex-col gap-3 p-4 border border-line/80 bg-ink/40 backdrop-blur-sm min-h-[200px] justify-center"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-45">728 × 90</span>
                <Sparkles size={14} className="text-amber/80 shrink-0" />
              </div>
              <div className="flex-1 border border-dashed border-magenta/30 bg-gradient-to-br from-magenta/[0.06] to-transparent flex items-center justify-center px-4 py-8">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta/70 text-center leading-relaxed">
                  {t("partnerAdPlaceholder")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
