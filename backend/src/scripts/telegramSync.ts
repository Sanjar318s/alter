import "../lib/env";
import { runTelegramPoll } from "./telegramPoll";

runTelegramPoll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[telegram:sync]", err);
    process.exit(1);
  });
