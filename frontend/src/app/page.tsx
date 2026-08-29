"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Compass,
  MessagesSquare,
  ScanLine,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import dynamic from "next/dynamic";
import { useLocale } from "@/lib/LocaleContext";
import { useAuth } from "@/lib/AuthContext";
import { APP_FEED_HOME } from "@/lib/appHome";
import { isPlatformOwnerUser } from "@/lib/owner";
import { Parallax } from "@/components/motion/Parallax";
import { SkeletonPage } from "@/components/ui/Skeleton";

const PartnerAdSlot = dynamic(
  () => import("@/components/marketing/PartnerAdSlot").then((m) => m.PartnerAdSlot),
  { ssr: false }
);

const SHELL = "max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("alter_token")) {
      router.prefetch(APP_FEED_HOME);
    }
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (user?.platformRole || isPlatformOwnerUser(user)) {
      router.replace(APP_FEED_HOME);
    }
  }, [loading, user, router]);

  if (loading) {
    return <SkeletonPage className="pt-14" />;
  }

  if (user?.platformRole || isPlatformOwnerUser(user)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 font-mono text-[13px] text-ink-45">
        Переходим в ленту…
      </div>
    );
  }

  return (
    <>
      <Hero />
      <HowItWorks />
      <PartnerAdSlot />
      <Roles />
    </>
  );
}

function Hero() {
  const { t } = useLocale();

  return (
    <section className="hero-wash border-b border-line py-14 md:py-20 lg:py-24 relative overflow-hidden">
      <Parallax
        speed={0.08}
        className="pointer-events-none absolute inset-x-0 -top-[10%] h-[120%] opacity-40"
      >
        <div className="landing-hero-glow w-full h-full" />
      </Parallax>
      <div className={SHELL}>
        <div className="relative z-[1] max-w-[720px]">
          <Parallax speed={0.04}>
            <p className="font-display font-extrabold text-[clamp(36px,6vw,64px)] leading-[1.05] tracking-tight text-paper">
              AlterCosPlay
            </p>
          </Parallax>
          <span className="font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.18em] text-magenta mt-4 block">
            {t("heroEyebrow")}
          </span>
          <h1 className="font-display font-extrabold text-[clamp(26px,3.6vw,40px)] leading-[1.15] mt-4 text-paper">
            {t("heroTitle")}
          </h1>
          <p className="text-[15px] md:text-[17px] text-ink-70 mt-5 leading-relaxed max-w-[520px]">
            {t("heroLead")}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Button href="/market">{t("watchHow")}</Button>
            <Button href="/reels" variant="outline">
              {t("reels")}
            </Button>
            <Button href="/register" variant="ghost">
              {t("createProfile")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLocale();
  const steps = [
    { n: "01", title: t("stepProfile"), text: t("stepProfileText"), href: "/explore" },
    { n: "02", title: t("stepExplore"), text: t("stepExploreText"), href: "/explore" },
    { n: "03", title: t("stepRequest"), text: t("stepRequestText"), href: "/register" },
  ];

  return (
    <section className="border-b border-line py-14 lg:py-18">
      <div className={SHELL}>
        <h2 className="font-display font-extrabold text-[clamp(22px,3vw,32px)]">{t("howItWorks")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
          {steps.map((s) => (
            <Link key={s.n} href={s.href} className="no-underline text-paper group">
              <div className="font-mono text-[12px] text-magenta tracking-widest">{s.n}</div>
              <div className="font-display font-bold text-[20px] mt-2 group-hover:text-magenta transition-colors">{s.title}</div>
              <p className="text-[14px] text-ink-70 mt-2 leading-relaxed">{s.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const { t } = useLocale();
  const items = [
    { icon: ScanLine, title: t("roleCosplayer"), text: t("roleCosplayerText") },
    { icon: LayoutDashboard, title: t("roleMaker"), text: t("roleMakerText"), href: "/studio" },
    { icon: Compass, title: t("rolePhoto"), text: t("rolePhotoText") },
    { icon: MessagesSquare, title: t("glossaryChannels"), text: t("glossaryChannelsText"), href: "/messages" },
    { icon: ClipboardList, title: t("glossaryCommission"), text: t("glossaryCommissionText") },
  ];

  return (
    <section className="py-14 lg:py-18 border-b border-line">
      <div className={SHELL}>
        <h2 className="font-display font-extrabold text-[clamp(22px,3vw,32px)]">{t("forWhom")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {items.map((item) => {
            const Icon = item.icon;
            const inner = (
              <>
                <Icon size={18} className="text-magenta" />
                <div className="font-display font-bold text-[16px] mt-3">{item.title}</div>
                <p className="text-[13px] text-ink-70 mt-2 leading-relaxed">{item.text}</p>
              </>
            );
            return item.href ? (
              <Link key={item.title} href={item.href} className="block no-underline text-paper border border-line/60 p-5 hover:border-magenta/50 transition-colors">
                {inner}
              </Link>
            ) : (
              <div key={item.title} className="border border-line/60 p-5">
                {inner}
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button href="/register">{t("join")}</Button>
          <Button href="/studio" variant="outline">{t("openStudio")}</Button>
        </div>
      </div>
    </section>
  );
}
