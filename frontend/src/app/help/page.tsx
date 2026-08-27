"use client";

import { LegalPage } from "@/components/LegalPage";

export default function HelpPage() {
  return (
    <LegalPage eyebrow="Помощь" title="Центр помощи">
      <p>
        <strong className="text-paper">Как заказать костюм.</strong> Откройте профиль мейкера → «Запросить коммишен».
        Заявка создаст чат и заказ в Студии — дальше договариваетесь прямо там.
      </p>
      <p>
        <strong className="text-paper">Как добавить работу.</strong> В своём профиле нажмите «Добавить работу».
        Это карточка готового костюма в портфолио, а не заказ.
      </p>
      <p>
        <strong className="text-paper">Про рилсы и продвижение.</strong> Рилсы публикуют блогеры и продавцы.
        При вашем согласии площадка может вынести рилсы и работы на YouTube (Shorts), Instagram, Facebook и TikTok
        аккаунтов бренда AlterCosPlay — вместе с никнеймом, ссылкой на профиль и хэштегами. Перед публикацией
        контент проходит проверку на тематику косплея. Счётчики из соцсетей появляются под рилсом или работой
        отдельно от лайков на платформе. Согласие можно снять в любой момент в настройках профиля.
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
