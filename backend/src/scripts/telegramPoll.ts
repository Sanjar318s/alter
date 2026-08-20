import "../lib/env";
import { migrate } from "../db/migrate";
import {
  AFISHA_SOURCE_KEY,
  COSPLAYERS_SOURCE_KEY,
  afishaChatUsername,
  afishaKeywords,
  createTelegramClient,
  loadSessionString,
  sourceChatUsername,
  sourceTopicId,
} from "../telegram/client";
import { pollSource, type PollStats } from "../telegram/publish";

export async function runTelegramPoll(): Promise<PollStats[]> {
  migrate();

  const session = loadSessionString();
  if (!session) {
    throw new Error("Нет сессии Telegram. Сначала: npm run telegram:auth (затем TELEGRAM_SESSION на Fly)");
  }

  const topicId = sourceTopicId();
  const chatUsername = sourceChatUsername();
  const afishaChat = afishaChatUsername();
  const keywords = afishaKeywords();
  const client = createTelegramClient(session);
  await client.connect();

  try {
    if (!(await client.checkAuthorization())) {
      throw new Error("Сессия недействительна. Запустите снова: npm run telegram:auth");
    }

    console.log(`✓ Telegram poll as ${(await client.getMe())?.username || "user"}`);
    const stats: PollStats[] = [];

    stats.push(
      await pollSource(client, chatUsername, {
        sourceKey: COSPLAYERS_SOURCE_KEY,
        topicId,
      })
    );
    stats.push(
      await pollSource(client, afishaChat, {
        sourceKey: AFISHA_SOURCE_KEY,
        requireKeywords: keywords,
      })
    );

    const scanned = stats.reduce((n, s) => n + s.scanned, 0);
    const published = stats.reduce((n, s) => n + s.published, 0);
    const skipped = stats.reduce((n, s) => n + s.skipped, 0);
    console.log(`[telegram:poll] done scanned=${scanned} published=${published} skipped=${skipped}`);
    return stats;
  } finally {
    await client.disconnect();
  }
}

async function main() {
  await runTelegramPoll();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[telegram:poll]", err);
    process.exit(1);
  });
}
