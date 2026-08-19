import { migrate } from "../db/migrate";
import { purgeDemoUsers } from "../db/purgeDemoUsers";

migrate();
const result = purgeDemoUsers();
console.log(
  result.removedUsers > 0
    ? `✓ Removed ${result.removedUsers} demo user(s): ${result.usernames.join(", ")}`
    : "✓ No demo users found"
);
