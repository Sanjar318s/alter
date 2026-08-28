"use client";

import { LegalPage } from "@/components/LegalPage";

export default function HelpPage() {
  return (
    <LegalPage eyebrow="Помощь" title="Центр помощи">
      <p>
        <strong className="text-paper">Биржа и заказ.</strong> На бирже — готовые работы продавцов. Откройте
        карточку работы → «Заказать», если кнопка есть. Она появляется только когда автор включил
        «Предоставляю услуги» при публикации.
      </p>
      <p>
        <strong className="text-paper">Как добавить работу на биржу.</strong> Продавец или партнёр: профиль →
        «Добавить работу». Это карточка <em>готового</em> результата. Переключатель «Предоставляю услуги»
        включает кнопку заказа для клиентов.
      </p>
      <p>
        <strong className="text-paper">Рилсы.</strong> Блогеры публикуют тематический контент о косплее.
        Продавцы — видео о процессе работы. Готовый результат выкладывается на биржу, не в рилсы.
      </p>
      <p>
        <strong className="text-paper">Вывод средств.</strong> Заявка уходит со статусом «ожидает» и
        подтверждается вручную. Автоматического вывода нет.
      </p>
      <p>
        Не нашли ответ? Напишите на{" "}
        <a href="mailto:hello@alter.local" className="text-magenta">hello@alter.local</a>.
      </p>
    </LegalPage>
  );
}
