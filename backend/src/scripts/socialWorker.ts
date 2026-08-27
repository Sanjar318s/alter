import "../lib/env";
import { migrate } from "../db/migrate";
import { processOneJob, syncSocialPosts } from "../lib/social/worker";

const POLL_MS = Number(process.env.SOCIAL_POLL_MS || 15_000);

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  migrate();
  console.log("[social:worker] started pollMs=", POLL_MS);

  let lastSyncPassAt = 0;

  for (;;) {
    try {
      const did = await processOneJob();
      if (!did) {
        if (Date.now() - lastSyncPassAt > 20 * 60_000) {
          lastSyncPassAt = Date.now();
          const n = await syncSocialPosts(20);
          console.log("[social:worker] sync pass", n);
        }
        await sleep(POLL_MS);
      }
    } catch (err) {
      console.error("[social:worker] loop error", err instanceof Error ? err.message : err);
      await sleep(POLL_MS);
    }
  }
}

main().catch((err) => {
  console.error("[social:worker] fatal", err);
  process.exit(1);
});
