import "../lib/env";
import { Api } from "telegram";
import { NewMessage } from "telegram/events";
import {
  createTelegramClient,
  loadSessionString,
  sourceChatUsername,
  sourceTopicId,
} from "../telegram/client";
import { handleTelegramMessage, seedTopicBaseline } from "../telegram/publish";

async function main() {
  const session = loadSessionString();
  if (!session) {
    console.error("Нет сессии Telegram. Сначала: npm run telegram:auth");
    process.exit(1);
  }

  const topicId = sourceTopicId();
  const chatUsername = sourceChatUsername();
  const client = createTelegramClient(session);
  await client.connect();

  if (!(await client.checkAuthorization())) {
    console.error("Сессия недействительна. Запустите снова: npm run telegram:auth");
    process.exit(1);
  }

  const entity = await client.getEntity(chatUsername);
  console.log(`✓ Telegram connected as ${(await client.getMe())?.username || "user"}`);
  console.log(`✓ Listening @${chatUsername}, topic ${topicId} → ch-events`);

  await seedTopicBaseline(client, entity, topicId);

  client.addEventHandler(
    async (event) => {
      try {
        const message = event.message;
        if (!(message instanceof Api.Message)) return;
        await handleTelegramMessage(client, message, topicId);
      } catch (err) {
        console.error("[telegram] handler error:", err);
      }
    },
    new NewMessage({ chats: [chatUsername] })
  );

  console.log("[telegram] sync running — Ctrl+C to stop");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
