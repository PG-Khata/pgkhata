import { Router } from "express";
import { z } from "zod";
import { db, emergencyContact, tenant } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  relation: z.string().min(1).max(50),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get emergency contacts for a tenant
router.get("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const contacts = await db
      .select()
      .from(emergencyContact)
      .where(eq(emergencyContact.tenantId, tenantId));

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch emergency contacts" });
  }
});

// Add emergency contact
router.post("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const body = createSchema.parse(req.body);

    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const [created] = await db
      .insert(emergencyContact)
      .values({ ...body, tenantId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add emergency contact" });
  }
});

// Delete emergency contact — scoped to property via tenant
router.delete("/:contactId", async (req: AuthenticatedRequest, res) => {
  try {
    const contactId = param(req, "contactId");

    // Verify the contact belongs to a tenant in this property
    const [deleted] = await db
      .delete(emergencyContact)
      .where(
        and(
          eq(emergencyContact.id, contactId),
          eq(
            emergencyContact.tenantId,
            // Subquery: contact's tenant must belong to this property
            db
              .select({ id: tenant.id })
              .from(tenant)
              .where(
                and(
                  eq(tenant.id, emergencyContact.tenantId),
                  eq(tenant.propertyId, req.propertyId!),
                )
              )
              .limit(1)
          ),
        )
      )
      .returning();

    if (!deleted) return res.status(404).json({ error: "Contact not found" });

    res.json({ message: "Contact deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete emergency contact" });
  }
});

export default router;
