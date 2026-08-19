import { eq } from "drizzle-orm";
import { db, schema } from "../db";

export type UserStats = {
  builds: number;
  followers: number;
  following: number;
  likes: number;
  orders: number;
};

export function getUserStats(userId: string) {
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return null;
  const builds = db.select().from(schema.builds).where(eq(schema.builds.userId, userId)).all();
  const followers = db.select().from(schema.follows).where(eq(schema.follows.followingId, userId)).all();
  const following = db.select().from(schema.follows).where(eq(schema.follows.followerId, userId)).all();
  const likes = builds.reduce((s, b) => s + (b.likesCount || 0), 0);
  const orders = db.select().from(schema.orders).where(eq(schema.orders.makerId, userId)).all();
  return {
    userId: user.id,
    username: user.username,
    stats: {
      builds: builds.length,
      followers: followers.length,
      following: following.length,
      likes,
      orders: orders.length,
    } satisfies UserStats,
  };
}
