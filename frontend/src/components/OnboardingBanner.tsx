"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const KEY = "alter_onboard_v1";
const EVENT = "alter-onboard";

const STEPS = [
  {
    title: "Исследовать",
    text: "Смотреть костюмы и открытые заказы",
    href: "/explore",
  },
  {
    title: "Профиль",
    text: "Портфолио и статус: берёт ли человек заказы",
    href: "/explore",
  },
  {
    title: "Студия",
    text: "Если шьёшь на заказ — доска заявок и дедлайны",
    href: "/studio",
  },
];

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

function getServerSnapshot() {
  return false;
}

export function OnboardingBanner() {
  const pathname = usePathname();
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!visible) return null;
  if (
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/u/") ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-stage border-t border-line px-5 sm:px-8 lg:px-10 py-2.5 sm:py-3 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-[1360px] mx-auto flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-magenta shrink-0 hidden sm:inline">
          С чего начать
        </span>
        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] sm:text-[13px]">
          {STEPS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="no-underline text-ink-70 hover:text-paper shrink-0"
            >
              <span className="font-mono text-[10px] sm:text-[11px] text-ink-45 mr-1">
                {i + 1}.
              </span>
              <span className="text-paper">{s.title}</span>
              <span className="hidden md:inline text-ink-45"> — {s.text}</span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="font-mono text-[11px] text-magenta hover:text-paper shrink-0 px-2 py-1 border border-line bg-ink/40 sm:bg-transparent sm:border-0"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
