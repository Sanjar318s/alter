import { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { n: number; reset: number }>();

export function clientKey(req: Request): string {
  const headers = (req.headers || {}) as Record<string, string | string[] | undefined>;
  const cf = headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  const fwd = headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  if (first && first.trim()) return first.split(",")[0].trim();
  return req.ip || "local";
}

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${clientKey(req)}:${req.path}`;
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
