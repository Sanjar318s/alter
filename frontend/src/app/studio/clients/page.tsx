"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmartImage } from "@/components/media/SmartImage";
import { messages as messagesApi, orders as ordersApi } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { SkeletonMessageList } from "@/components/ui/Skeleton";

export default function ClientsPage() {
  const toast = useToast();
  const { formatSum } = useLocale();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "spent" | "date">("date");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    ordersApi
      .clients()
      .then((r) => {
        setClients(r.clients || []);
        const n: Record<string, string> = {};
        for (const c of r.clients || []) n[c.id] = c.note || "";
        setNotes(n);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => setLoading(false));
  }, [toast]);

  const list = useMemo(() => {
    let rows = clients.filter((c) => {
      if (q && !`${c.username} ${c.displayName}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "active") return c.active;
      if (filter === "done") return !c.active;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return String(a.username).localeCompare(b.username);
      if (sort === "spent") return (b.spent || 0) - (a.spent || 0);
      return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
    });
    return rows;
  }, [clients, q, sort, filter]);

  return (
    <StudioShell>
      <div className="p-4 sm:p-6">
        <PageHeader eyebrow="Клиенты" title="Люди, которые заказывали у вас" />
        <div className="flex flex-wrap gap-2 mb-4">
          <input className="field max-w-xs" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field-box" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="done">Завершённые</option>
          </select>
          <select className="field-box" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="date">По дате</option>
            <option value="name">По имени</option>
            <option value="spent">По сумме</option>
          </select>
        </div>
        {loading && <SkeletonMessageList className="px-0" />}
        {!loading && list.length === 0 && <EmptyState title="Клиенты появятся здесь после первого заказа" />}
        <div className="flex flex-col gap-3">
          {list.map((c) => (
            <div key={c.id} className="border border-line p-3 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
              <div className="w-10 h-10 overflow-hidden shrink-0">
                <SmartImage src={c.avatarUrl} alt={c.username} fallback={c.username} />
              </div>
              <div className="flex-1 min-w-0 basis-[12rem]">
                <Link href={`/profile/${c.username}`} className="text-paper no-underline font-medium">{c.displayName || c.username}</Link>
                <div className="font-mono text-[11px] text-ink-45">
                  {c.ordersCount} зак. · {formatSum(c.spent)} · {c.kind === "regular" ? "постоянный" : "новый"}
                </div>
                <input
                  className="field mt-2"
                  placeholder="Заметка о клиенте"
                  value={notes[c.id] || ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                  onBlur={() => ordersApi.clientNote(c.id, notes[c.id] || "").catch((e) => toast(e.message, true))}
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={async () => {
                const conv = await messagesApi.createConversation(c.id);
                router.push(`/messages/${conv.conversationId}`);
              }}>Написать</Button>
              <Button size="sm" href="/studio" className="flex-1 sm:flex-none">Новый заказ</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
