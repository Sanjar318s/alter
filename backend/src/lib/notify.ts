import { v4 as uuid } from "uuid";
import { db, schema } from "../db";
import { pushNotification } from "./pushRealtime";
import { deleteUpload } from "./storage";

export function notify(
  userId: string,
  type: string,
  payload: Record<string, unknown>
) {
  const id = uuid();
  db.insert(schema.notifications)
    .values({
      id,
      userId,
      type,
      payloadJson: JSON.stringify(payload),
    })
    .run();
  pushNotification(userId, { id, type, ...payload });
}

export function franchiseSlug(name?: string | null) {
  const n = (name || "").toLowerCase();
  const map: [string, string][] = [
    ["genshin", "genshin-impact"],
    ["honkai", "honkai-star-rail"],
    ["nier", "nier-automata"],
    ["league", "league-of-legends"],
    ["vocaloid", "vocaloid"],
    ["miku", "vocaloid"],
    ["chainsaw", "chainsaw-man"],
    ["demon slayer", "demon-slayer"],
    ["jujutsu", "jujutsu-kaisen"],
    ["overwatch", "overwatch"],
  ];
  for (const [needle, slug] of map) {
    if (n.includes(needle)) return slug;
  }
  return "other";
}

export function unlinkUpload(url?: string | null) {
  void deleteUpload(url);
}
