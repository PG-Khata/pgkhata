import type { Response, NextFunction } from "express";
import { db, property } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "./auth";
import { param } from "../lib/http";

/**
 * Resolves `:propertyId` and proves it belongs to the authenticated owner
 * before any nested resource query runs. Replaces six copies of a local
 * `verifyPropertyOwnership` helper, and gives downstream handlers a
 * `string`-typed `req.propertyId` instead of Express's
 * `string | string[] | undefined`.
 *
 * Answers 404 rather than 403 on a foreign property so the endpoint cannot be
 * used to prove that someone else's property id exists.
 */
export async function requireProperty(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const propertyId = param(req, "propertyId");

    const [prop] = await db
      .select()
      .from(property)
      .where(
        and(eq(property.id, propertyId), eq(property.ownerId, req.ownerId!)),
      )
      .limit(1);

    if (!prop) {
      return res.status(404).json({ error: "Property not found" });
    }

    req.propertyId = prop.id;
    req.property = prop;
    next();
  } catch (error) {
    next(error);
  }
}
