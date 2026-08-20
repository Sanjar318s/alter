import "../lib/env";
import {
  createTelegramClient,
  loadSessionString,
  sourceChatUsername,
  sourceTopicId,
} from "../telegram/client";
import { backfillTopicHistory } from "../telegram/publish";

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

  console.log(`✓ Telegram connected as ${(await client.getMe())?.username || "user"}`);
  console.log(`✓ Backfill @${chatUsername}, topic ${topicId} → ch-events`);

  await backfillTopicHistory(client, chatUsername, topicId);
  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
