"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "@/lib/AuthContext";
import { connectRealtime, disconnectRealtime, subscribeRealtime } from "@/lib/realtimeHub";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!user) {
      disconnectRealtime();
      return;
    }
    const authToken = localStorage.getItem("alter_token");
    if (!authToken) return;

    connectRealtime(authToken);
    const unsub = subscribeRealtime((event) => {
      if (event === "notification") {
        mutate("/api/notifications/unread-count");
        mutate((key) => typeof key === "string" && key.startsWith("/api/notifications"));
      }
      if (event === "message") {
        mutate("/api/messages/unread-count");
        mutate((key) => typeof key === "string" && key.startsWith("/api/messages"));
      }
    });

    return () => {
      unsub();
      disconnectRealtime();
    };
  }, [user?.id, mutate]);

  return children;
}
