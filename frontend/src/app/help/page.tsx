"use client";

import { LegalPage } from "@/components/LegalPage";

export default function HelpPage() {
  return (
    <LegalPage eyebrow="Помощь" title="Центр помощи">
      <p>
        <strong className="text-paper">Как заказать костюм.</strong> Откройте профиль мейкера → «Запросить коммишен».
        Заявка создаёт чат и заказ в Студии.
      </p>
      <p>
        <strong className="text-paper">Как добавить билд.</strong> В своём профиле нажмите «+ Добавить билд».
        Это портфолио костюма, не заказ.
      </p>
      <p>
        <strong className="text-paper">Вывод средств.</strong> Заявка уходит со статусом «ожидает» и подтверждается
        вручную. Автоматического вывода нет.
      </p>
      <p>
        Не нашли ответ? Напишите на{" "}
        <a href="mailto:hello@alter.local" className="text-magenta">hello@alter.local</a>.
      </p>
    </LegalPage>
  );
}
