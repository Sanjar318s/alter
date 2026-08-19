"use client";

import { FormEvent, useState } from "react";
import { LegalPage } from "@/components/LegalPage";
import { Button } from "@/components/ui/Button";
import { partners } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const TYPES = [
  { id: "fest", label: "Организатор феста / конвента" },
  { id: "atelier", label: "Ателье / студия костюма" },
  { id: "studio", label: "Фотостудия" },
  { id: "media", label: "Медиа / блог / спонсор" },
];

export default function PartnersPage() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    type: "fest",
    city: "",
    contactName: "",
    contactEmail: "",
    message: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await partners.apply(form);
      setSent(true);
      toast("Заявка отправлена");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось отправить", true);
    } finally {
      setPending(false);
    }
  }

  return (
    <LegalPage eyebrow="Партнёрам" title="Конвенты, ателье, медиа">
      <p>
        Ищем партнёров: организаторов фестов, ателье, фотостудии и медиа. Можем сделать канал мероприятия,
        каталог аренды и отдельную витрину мейкеров.
      </p>
      <ul className="list-disc pl-5 space-y-2 text-ink-70 my-6">
        <li>Канал мероприятия и страница феста</li>
        <li>Витрина ателье с curated-мейкерами</li>
        <li>Каталог аренды костюмов и крафта</li>
        <li>Нативная реклама в ленте Explore и на главной</li>
      </ul>

      <section id="apply" className="mt-10 pt-8 border-t border-line">
        <h2 className="font-display font-extrabold text-xl mb-2">Стать партнёром</h2>
        <p className="text-ink-70 text-[14px] mb-6">Заполните форму — мы свяжемся и обсудим пакет размещения.</p>

        {sent ? (
          <p className="text-magenta font-mono text-[13px]">Заявка принята. Мы напишем на указанный email.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-[480px]">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45">Тип партнёра</span>
              <select
                className="field-box"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                required
              >
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45">Город</span>
              <input
                className="field-box"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Ташкент"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45">Имя / организация</span>
              <input
                className="field-box"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45">Email</span>
              <input
                type="email"
                className="field-box"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45">Что хотите показать</span>
              <textarea
                className="field-box min-h-[100px]"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Фест в мае, нужен канал и спонсорский блок…"
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Отправляем…" : "Отправить заявку"}
            </Button>
          </form>
        )}
      </section>
    </LegalPage>
  );
}
