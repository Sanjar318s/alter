"use client";

import { useEffect, useMemo, useState } from "react";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { calendar, orders as ordersApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";

type View = "month" | "week" | "day";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function CalendarPage() {
  const toast = useToast();
  const router = useRouter();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) {
      setView("week");
    }
  }, []);

  const from = useMemo(() => {
    if (view === "day") return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()).toISOString();
    if (view === "week") return startOfWeek(cursor).toISOString();
    return new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
  }, [view, cursor]);
  const to = useMemo(() => {
    if (view === "day") return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1).toISOString();
    if (view === "week") {
      const s = startOfWeek(cursor);
      s.setDate(s.getDate() + 7);
      return s.toISOString();
    }
    return new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();
  }, [view, cursor]);

  useEffect(() => {
    setLoading(true);
    calendar
      .list(from, to)
      .then((r) => {
        setEvents(r.events || []);
        setDeadlines(r.deadlines || []);
      })
      .catch((e) => toast(e.message, true))
      .finally(() => setLoading(false));
  }, [from, to, toast]);

  function shift(dir: number) {
    const n = new Date(cursor);
    if (view === "day") n.setDate(n.getDate() + dir);
    else if (view === "week") n.setDate(n.getDate() + dir * 7);
    else n.setMonth(n.getMonth() + dir);
    setCursor(n);
  }

  const cells = useMemo(() => {
    if (view === "day") return [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())];
    if (view === "week") {
      const s = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        return d;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view, cursor]);

  function itemsOn(d: Date) {
    const key = d.toISOString().slice(0, 10);
    const ev = events.filter((e) => new Date(e.startsAt).toISOString().slice(0, 10) === key);
    const dl = deadlines.filter((e) => e.startsAt && new Date(e.startsAt).toISOString().slice(0, 10) === key);
    return [...ev, ...dl];
  }

  return (
    <StudioShell>
      <div className="p-4 sm:p-6">
        <PageHeader eyebrow="Календарь" title="Дедлайны и личные события" />
        <div className="flex flex-wrap gap-2 mb-4">
          {(["month", "week", "day"] as View[]).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "primary" : "outline"} onClick={() => setView(v)}>
              {v === "month" ? "Месяц" : v === "week" ? "Неделя" : "День"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => shift(-1)}>←</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Сегодня</Button>
          <Button size="sm" variant="outline" onClick={() => shift(1)}>→</Button>
          <span className="font-mono text-[12px] text-ink-45 self-center">
            {cursor.toLocaleDateString("ru", { month: "long", year: "numeric" })}
          </span>
        </div>
        {loading && (
          <div className="grid grid-cols-7 gap-1 mb-4" role="status" aria-label="Загрузка">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[72px] sm:min-h-[88px] rounded-none" />
            ))}
          </div>
        )}
        {!loading && (
        <div className={cn("grid gap-1", view === "month" ? "grid-cols-7" : view === "week" ? "grid-cols-7" : "grid-cols-1")}>
          {cells.map((d) => {
            const list = itemsOn(d);
            const key = d.toISOString().slice(0, 10);
            return (
              <button
                key={key + d.getDate()}
                type="button"
                onClick={() => setDayOpen(key)}
                className={cn(
                  "min-h-[88px] border border-line p-1.5 text-left bg-stage hover:border-magenta",
                  view === "month" && "min-h-[72px] sm:min-h-[88px] text-[10px] sm:text-[11px]"
                )}
              >
                <div className="font-mono text-[10px] text-ink-45">{d.getDate()}</div>
                {list.slice(0, 3).map((it) => (
                  <div key={it.id} className="text-[11px] truncate text-magenta">{it.title}</div>
                ))}
                {list.length === 0 && <div className="text-[10px] text-ink-45">Нет событий</div>}
              </button>
            );
          })}
        </div>
        )}
      </div>
      {dayOpen && (
        <Modal title={dayOpen} onClose={() => setDayOpen(null)}>
          {itemsOn(new Date(dayOpen)).length === 0 && <EmptyState compact title="Нет событий" />}
          {itemsOn(new Date(dayOpen)).map((it) => (
            <button
              key={it.id}
              type="button"
              className="block w-full text-left py-2 border-b border-line bg-transparent text-[13px]"
              onClick={() => it.orderId && router.push("/studio")}
            >
              {it.title}
            </button>
          ))}
          <Button className="mt-3" onClick={() => setAddOpen(true)}>Добавить событие</Button>
        </Modal>
      )}
      {addOpen && (
        <Modal title="Новое событие" onClose={() => setAddOpen(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await calendar.create({
                  title: String(fd.get("title")),
                  startsAt: `${dayOpen || new Date().toISOString().slice(0, 10)}T${fd.get("time") || "10:00"}:00`,
                  note: String(fd.get("note") || ""),
                });
                setAddOpen(false);
                const r = await calendar.list(from, to);
                setEvents(r.events || []);
              } catch (err) {
                toast(err instanceof Error ? err.message : "Ошибка", true);
              }
            }}
          >
            <input name="title" className="field" placeholder="Название" required />
            <input name="time" className="field" type="time" defaultValue="10:00" />
            <textarea name="note" className="field-box" rows={3} placeholder="Заметка" />
            <Button type="submit">Сохранить</Button>
          </form>
        </Modal>
      )}
    </StudioShell>
  );
}
