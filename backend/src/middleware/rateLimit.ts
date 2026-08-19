import { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || "local"}:${req.path}`;
    const now = Date.now();
    const cur = buckets.get(key);
    if (!cur || cur.reset < now) {
      buckets.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    cur.n += 1;
    if (cur.n > max) {
      return res.status(429).json({ error: "Слишком много запросов, подождите" });
    }
    next();
  };
}
