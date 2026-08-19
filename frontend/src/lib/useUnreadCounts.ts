import useSWR from "swr";
import { useEffect } from "react";
import { subscribeRealtime } from "@/lib/realtimeHub";

export function apiFetcher<T>(path: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("alter_token") : null;
  const api = process.env.NEXT_PUBLIC_API_URL || "";
  return fetch(`${api}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).then(async (res) => {
    if (!res.ok) throw new Error("request failed");
    return res.json() as Promise<T>;
  });
}

export function useUnreadCounts(enabled: boolean) {
  const { data: msg, mutate: mutateMsg } = useSWR(enabled ? "/api/messages/unread-count" : null, apiFetcher<{ count: number }>, {
    refreshInterval: 60000,
  });
  const { data: notif, mutate: mutateNotif } = useSWR(enabled ? "/api/notifications/unread-count" : null, apiFetcher<{ count: number }>, {
    refreshInterval: 60000,
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribeRealtime((event) => {
      if (event === "message") mutateMsg();
      if (event === "notification") mutateNotif();
    });
  }, [enabled, mutateMsg, mutateNotif]);
  return { messages: msg?.count || 0, notifications: notif?.count || 0 };
}
