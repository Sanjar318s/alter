import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { adminOnly } from "./roles";

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  return adminOnly(req, res, next);
}
