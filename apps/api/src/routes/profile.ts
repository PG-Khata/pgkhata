import { Router } from "express";
import { z } from "zod";
import { db, ownerProfile, user } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireOwner);

const INDIAN_MOBILE = /^(\+91)?[6-9]\d{9}$/;

export const updateProfileSchema = z.object({
  phone: z
    .union([z.string(), z.null()])
    // Owners type numbers with spaces and dashes; strip them before validating.
    .transform((value) => (value ?? "").replace(/[\s-]/g, ""))
    .refine(
      (value) => value === "" || INDIAN_MOBILE.test(value),
      "Enter a valid Indian mobile number",
    )
    // "" and null clear the number. Anything valid is stored in one canonical
    // +91 form so the owner and admin views never disagree on formatting.
    .transform((value) => (value === "" ? null : `+91${value.slice(-10)}`)),
});

/** The signed-in owner's own profile. Owner-scoped; never takes an id. */
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const [profile] = await db
      .select({
        id: ownerProfile.id,
        phone: ownerProfile.phone,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(ownerProfile)
      .innerJoin(user, eq(user.id, ownerProfile.userId))
      .where(eq(ownerProfile.id, req.ownerId!))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Owner profile not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/", async (req: AuthenticatedRequest, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const [updated] = await db
      .update(ownerProfile)
      .set({ phone: data.phone, updatedAt: new Date() })
      .where(eq(ownerProfile.id, req.ownerId!))
      .returning({ id: ownerProfile.id, phone: ownerProfile.phone });

    if (!updated) return res.status(404).json({ error: "Owner profile not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
