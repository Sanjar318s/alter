"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/LocaleContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import type { MsgKey } from "@/lib/locale/messages";

const ONBOARD_KEY = "alter_onboard_v1";
const ONBOARD_EVENT = "alter-onboard";

const COLUMNS: { title: MsgKey; links: { label: MsgKey; href: string }[] }[] = [
  {
    title: "platform",
    links: [
      { label: "explore", href: "/market" },
      { label: "studio", href: "/studio" },
      { label: "messages", href: "/messages" },
    ],
  },
  {
    title: "company",
    links: [
      { label: "about", href: "/about" },
      { label: "rules", href: "/rules" },
      { label: "privacy", href: "/privacy" },
    ],
  },
  {
    title: "support",
    links: [
      { label: "help", href: "/help" },
      { label: "contacts", href: "/contacts" },
      { label: "partners", href: "/partners" },
    ],
  },
];

function subscribe(onStoreChange: () => void) {
  window.addEventListener(ONBOARD_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(ONBOARD_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getOnboardingVisible() {
  try {
    return localStorage.getItem(ONBOARD_KEY) !== "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function Footer() {
  const { t } = useLocale();
  const onboardingVisible = useSyncExternalStore(
    subscribe,
    getOnboardingVisible,
    getServerSnapshot
  );

  return (
    <footer
      className={cn(
        "border-t border-line bg-ink pt-10 px-5 sm:px-8 lg:px-10 mt-auto",
        onboardingVisible ? "pb-28 md:pb-24" : "pb-10"
      )}
    >
      <div className="max-w-[1360px] mx-auto grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
        <div className="col-span-2 lg:col-span-1">
          <BrandLogo href="/" className="mb-3" />
          <p className="text-[11px] text-ink-45 font-mono leading-relaxed max-w-[260px]">
            {t("footerTagline")}
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-magenta mb-4">
              {t(column.title)}
            </h4>
            <div className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12px] text-ink-45 hover:text-paper no-underline transition-colors"
                >
                  {t(link.label)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
