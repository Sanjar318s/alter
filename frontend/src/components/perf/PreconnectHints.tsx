"use client";

import { useEffect } from "react";

/** DNS/TLS warm-up for API and media CDN (free). */
export function PreconnectHints() {
  useEffect(() => {
    const hosts = new Set<string>();
    const api = process.env.NEXT_PUBLIC_API_URL;
    const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    for (const raw of [api, r2]) {
      if (!raw) continue;
      try {
        hosts.add(new URL(raw).origin);
      } catch {
        /* ignore */
      }
    }
    // Same-origin rewrites: still help when API is absolute
    for (const origin of hosts) {
      if (origin === window.location.origin) continue;
      for (const rel of ["preconnect", "dns-prefetch"] as const) {
        if (document.querySelector(`link[rel="${rel}"][href="${origin}"]`)) continue;
        const link = document.createElement("link");
        link.rel = rel;
        link.href = origin;
        if (rel === "preconnect") link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    }
  }, []);
  return null;
}
