import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isOwnerUsername } from "./owner";

/** Remove any stale blocks against the platform owner — owner is always immune. */
export function clearOwnerBlocks() {
  const owner = db
    .select()
    .from(schema.users)
    .all()
    .find((u) => isOwnerUsername(u.username));
  if (!owner) return 0;
  const before = db.select().from(schema.blocks).where(eq(schema.blocks.blockedId, owner.id)).all().length;
  if (!before) return 0;
  db.delete(schema.blocks).where(eq(schema.blocks.blockedId, owner.id)).run();
  return before;
}
