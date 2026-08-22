"use client";

import { LegalPage } from "@/components/LegalPage";

export default function ContactsPage() {
  return (
    <LegalPage eyebrow="Контакты" title="Связаться с AlterCosPlay">
      <p>
        Вопросы, идеи, сотрудничество — пишите:{" "}
        <a href="mailto:hello@alter.local" className="text-magenta">hello@alter.local</a>. Читаем всё.
      </p>
      <p>
        Жалоба на пользователя или контент — через кнопку «Пожаловаться» в профиле или в чате. Заявки смотрит
        администратор, а не робот.
      </p>
      <p>Для демо-входа: ник <code className="text-paper">demo.nyx</code> или <code className="text-paper">luna.s</code>, пароль <code className="text-paper">alter123</code>.</p>
    </LegalPage>
  );
}
