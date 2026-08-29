"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { mediaSrc } from "@/lib/format";

export function SmartImage({
  src,
  alt,
  className,
  style,
  fallback,
  priority = false,
  size = "full",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
  priority?: boolean;
  size?: "full" | "card" | "thumb";
}) {
  const preferred = mediaSrc(src, size);
  const full = mediaSrc(src, "full");
  const [url, setUrl] = useState(preferred || full);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(preferred || full);
    setLoaded(false);
    setFailed(false);
  }, [preferred, full]);

  if (!url || failed) {
    const letter = (fallback || alt || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center bg-stage text-ink-45 font-display font-extrabold",
          className
        )}
        style={style}
        aria-label={alt}
      >
        {letter}
      </div>
    );
  }

  return (
    <span className={cn("smart-image", className)} style={style}>
      {!loaded ? <span className="smart-image-skel skeleton-block" aria-hidden /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={cn("smart-image-img", loaded && "is-loaded")}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (size !== "full" && url !== full && full) {
            setUrl(full);
            setLoaded(false);
            return;
          }
          setFailed(true);
        }}
      />
    </span>
  );
}
