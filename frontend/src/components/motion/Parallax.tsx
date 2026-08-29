"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Subtle scroll parallax. Respects prefers-reduced-motion. */
export function Parallax({
  children,
  speed = 0.12,
  className,
  style,
  as: Tag = "div",
}: {
  children?: ReactNode;
  /** Positive = moves slower than scroll (background feel). Typical 0.08–0.2 */
  speed?: number;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const viewMid = window.innerHeight / 2;
      const offset = (viewMid - mid) * speed;
      el.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <Tag
      ref={ref as never}
      className={cn("parallax-layer", className)}
      style={style}
    >
      {children}
    </Tag>
  );
}
