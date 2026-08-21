"use client";

import { cn } from "@/lib/cn";
import { mediaSrc } from "@/lib/format";

export function SmartImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const url = mediaSrc(src);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className={cn("object-cover w-full h-full", className)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const letter = (fallback || alt || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center bg-stage text-ink-45 font-display font-extrabold",
        className
      )}
      aria-label={alt}
    >
      {letter}
    </div>
  );
}
