/**
 * requireAuth — any signed-in Clerk user passes.
 * Use this for endpoints that should be accessible to all users (not just admin).
 */
import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
