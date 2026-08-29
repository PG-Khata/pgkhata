import { Request, Response, NextFunction } from "express";
import { auth } from "@pgkhata/auth";
import { db, ownerProfile } from "@pgkhata/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  ownerId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [profile] = await db
      .select()
      .from(ownerProfile)
      .where(eq(ownerProfile.userId, req.user.id))
      .limit(1);

    if (!profile) {
      return res.status(403).json({ error: "Owner profile not found" });
    }

    req.ownerId = profile.id;
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
