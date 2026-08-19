import { Router } from "express";

const router = Router();

let cache: { rates: Record<string, number>; updatedAt: string; fetchedAt: number } | null = null;
const TTL = 60 * 60 * 1000;

router.get("/", async (_req, res) => {
  if (cache && Date.now() - cache.fetchedAt < TTL) {
    return res.json(cache);
  }
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/UZS");
    const data = (await r.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (data.result !== "success" || !data.rates) throw new Error("fx");
    const want = ["UZS", "KZT", "KRW", "USD", "JPY", "EUR", "RUB"];
    const rates: Record<string, number> = { UZS: 1 };
    for (const k of want) {
      if (typeof data.rates[k] === "number") rates[k] = data.rates[k];
    }
    cache = { rates, updatedAt: data.time_last_update_utc || new Date().toISOString(), fetchedAt: Date.now() };
    res.json(cache);
  } catch {
    res.json(cache || { rates: { UZS: 1 }, updatedAt: null, fetchedAt: Date.now() });
  }
});

export default router;
