import "../lib/env";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { migrate } from "../db/migrate";
import { ADMIN_USERNAME, flagsForUsername, normalizeUsername } from "../lib/owner";
import { normalizePhone } from "../lib/otp";

async function main() {
  migrate();

  const username = normalizeUsername(process.env.OWNER_USERNAME || ADMIN_USERNAME);
  const phone = normalizePhone(process.env.OWNER_PHONE || "");
  const password = process.env.OWNER_PASSWORD || "";
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    console.error("OWNER_PHONE required, e.g. +998XXXXXXXXX");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("OWNER_PASSWORD required (min 6 chars)");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const roleFlags = flagsForUsername("cosplayer", username);
  const email = `p${phone.replace(/\D/g, "")}@phone.alter.local`;

  const existingNick = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  const existingPhone = db.select().from(schema.users).where(eq(schema.users.phone, phone)).get();
  if (existingNick && existingPhone && existingNick.id !== existingPhone.id) {
    console.error(`Phone ${phone} already belongs to @${existingPhone.username}`);
    process.exit(1);
  }

  const user = existingNick || existingPhone;
  if (user) {
    db.update(schema.users)
      .set({ username, phone, email: user.email?.includes("@phone.alter.local") ? email : user.email || email, passwordHash: hash, roleFlags })
      .where(eq(schema.users.id, user.id))
      .run();
    const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
    if (profile) {
      db.update(schema.profiles)
        .set({ staffRole: "owner", staffBadgeHidden: false, phone, displayName: profile.displayName || username })
        .where(eq(schema.profiles.userId, user.id))
        .run();
    } else {
      db.insert(schema.profiles)
        .values({ userId: user.id, displayName: username, phone, staffRole: "owner", staffBadgeHidden: false })
        .run();
    }
    console.log(`✓ Owner updated @${username} ${user.id}`);
  } else {
    const id = uuid();
    db.insert(schema.users)
      .values({ id, email, username, passwordHash: hash, roleFlags, phone })
      .run();
    db.insert(schema.profiles)
      .values({ userId: id, displayName: username, phone, staffRole: "owner", staffBadgeHidden: false })
      .run();
    console.log(`✓ Owner created @${username} ${id}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
