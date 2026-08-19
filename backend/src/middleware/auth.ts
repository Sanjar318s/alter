import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { blockedResponsePayload, getActiveBan } from "../lib/blocking";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

const JWT_SECRET = process.env.JWT_SECRET || "alter-dev-secret-key-change-in-production";

export interface AuthRequest extends Request {
  userId?: string;
  tokenJti?: string;
}

function readToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function isRevoked(jti?: string) {
  if (!jti) return false;
  try {
    const row = db.select().from(schema.revokedTokens).where(eq(schema.revokedTokens.jti, jti)).get();
    return Boolean(row);
  } catch {
    return false;
  }
}

function touchLastSeen(userId: string) {
  try {
    db.update(schema.profiles).set({ lastSeen: new Date() }).where(eq(schema.profiles.userId, userId)).run();
  } catch {
    /* ignore */
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; jti?: string };
    if (isRevoked(payload.jti)) return res.status(401).json({ error: "Session expired" });
    const ban = getActiveBan(payload.userId);
    if (ban) return res.status(403).json(blockedResponsePayload(ban));
    req.userId = payload.userId;
    req.tokenJti = payload.jti;
    touchLastSeen(payload.userId);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; jti?: string };
      if (!isRevoked(payload.jti)) {
        req.userId = payload.userId;
        req.tokenJti = payload.jti;
        touchLastSeen(payload.userId);
      }
    } catch {
      /* ignore */
    }
  }
  next();
}

export { JWT_SECRET };
