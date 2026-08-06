import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = "rottschaferwilson@gmail.com";

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (primaryEmail !== ADMIN_EMAIL) {
      req.log.warn({ userId: auth.userId, email: primaryEmail }, "Non-admin access attempt blocked");
      res.status(403).json({ error: "Forbidden: Admin access only" });
      return;
    }

    next();
  } catch (err) {
    logger.error({ err }, "Failed to verify admin user");
    res.status(401).json({ error: "Unauthorized" });
  }
}
