import "../lib/env";
import { migrate } from "../db/migrate";
import { purgeInactivePlatformAccounts } from "../lib/inactivityPurge";

migrate();
const result = purgeInactivePlatformAccounts();
console.log(
  `[inactivity] checked=${result.checked} deleted=${result.deleted.length} dryRun=${result.dryRun}` +
    (result.deleted.length ? ` users=${result.deleted.join(",")}` : "")
);
process.exit(0);
