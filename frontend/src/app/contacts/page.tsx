"use client";

import { LegalPage } from "@/components/LegalPage";

export default function ContactsPage() {
  return (
    <LegalPage eyebrow="Контакты" title="Связаться с AlterCosPlay">
      <p>Почта: <a href="mailto:hello@alter.local" className="text-magenta">hello@alter.local</a></p>
      <p>Модерация и жалобы: через кнопку «Пожаловаться» в профиле или в чате. Заявки смотрит администратор.</p>
      <p>Для демо-входа: ник <code className="text-paper">demo.nyx</code> или <code className="text-paper">luna.s</code>, пароль <code className="text-paper">alter123</code>.</p>
    </LegalPage>
  );
}
