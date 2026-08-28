import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { getOwnerUserId } from "./owner";

/** Remove any stale blocks against the platform owner — owner is always immune. */
export function clearOwnerBlocks() {
  const ownerId = getOwnerUserId();
  if (!ownerId) return 0;
  const before = db.select().from(schema.blocks).where(eq(schema.blocks.blockedId, ownerId)).all().length;
  if (!before) return 0;
  db.delete(schema.blocks).where(eq(schema.blocks.blockedId, ownerId)).run();
  return before;
}
