"use client";

const SESSION_KEY = "alter_ad_session";

export function getAdSessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function trackPlacement(
  placementId: string,
  type: "impression" | "click",
  city?: string
) {
  import("@/lib/api").then(({ placements }) => {
    placements.track({ placementId, type, sessionId: getAdSessionId(), city }).catch(() => {});
  });
}
