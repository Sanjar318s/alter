"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Frame } from "@/components/Frame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { users } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

export default function EventsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.username === username;
  const [events, setEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function load() {
    users
      .events(username)
      .then((d) => setEvents(d.events || []))
      .catch((e) => setError(e.message));
  }
  useEffect(load, [username]);

  return (
    <div className="pt-12 px-4 sm:px-6 pb-20 max-w-[800px] mx-auto min-w-0">
      <PageHeader eyebrow="Мероприятия" title={`Конвенты ${username}`}>
        {isOwner && (
          <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
            Добавить
          </Button>
        )}
      </PageHeader>
      {error && <p className="text-amber text-[13px] mb-3">{error}</p>}
      {events.length === 0 && <EmptyState title="Пока нет конвентов" />}
      <div className="flex flex-col gap-3">
        {events.map((e: any, i: number) => (
          <Frame key={`${e.name}-${i}`} className="p-4 bg-stage flex justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] text-magenta">{e.date}</div>
              <div className="font-display font-bold mt-1">{e.name}</div>
              <div className="text-[13px] text-ink-45">{e.city}</div>
            </div>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const next = events.filter((_, j) => j !== i);
                  try {
                    await users.saveEvents(username, next);
                    setEvents(next);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Ошибка", true);
                  }
                }}
              >
                Удалить
              </Button>
            )}
          </Frame>
        ))}
      </div>
      <Link href={`/profile/${username}`} className="block mt-6 text-[13px] text-ink-45">
        ← Назад в профиль
      </Link>
      {open && (
        <Modal title="Новый конвент" onClose={() => setOpen(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              const next = [
                ...events,
                { date: String(fd.get("date")), name: String(fd.get("name")), city: String(fd.get("city")) },
              ];
              try {
                await users.saveEvents(username, next);
                setEvents(next);
                setOpen(false);
              } catch (err) {
                toast(err instanceof Error ? err.message : "Ошибка", true);
              }
            }}
          >
            <input name="date" type="date" className="field" required />
            <input name="name" className="field" placeholder="Название" required />
            <input name="city" className="field" placeholder="Город" required />
            <Button type="submit">Сохранить</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
