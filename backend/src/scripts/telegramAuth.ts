import "../lib/env";
import input from "input";
import { createTelegramClient, saveSessionString } from "../telegram/client";

async function main() {
  const client = createTelegramClient("");
  await client.connect();

  console.log("ALTER — авторизация Telegram (личный аккаунт)");
  console.log("Введите телефон и код из приложения Telegram.\n");

  await client.start({
    phoneNumber: async () => {
      const fromEnv = process.env.TELEGRAM_PHONE?.trim();
      if (fromEnv) {
        console.log(`Phone: ${fromEnv}`);
        return fromEnv;
      }
      return input.text("Телефон (+998...): ");
    },
    password: async () => {
      const fromEnv = process.env.TELEGRAM_2FA_PASSWORD?.trim();
      if (fromEnv !== undefined) return fromEnv;
      return input.text("Пароль 2FA (если есть, иначе Enter): ");
    },
    phoneCode: async () => {
      const fromEnv = process.env.TELEGRAM_CODE?.trim();
      if (fromEnv) {
        console.log("Code: ******");
        return fromEnv;
      }
      return input.text("Код из Telegram: ");
    },
    onError: (err) => console.error(err),
  });

  const session = client.session.save() as unknown as string;
  saveSessionString(session);
  console.log("\n✓ Сессия сохранена в backend/data/telegram.session");
  console.log("Запустите синхронизацию: npm run telegram:sync");
  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
