import { Router } from "express";
import { z } from "zod";
import { db, property, room, tenant, complaint } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  email: z.string().email().optional(),
  roomId: z.string().uuid(),
});

const complaintSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  roomNumber: z.string().optional(),
});

// Get signup form data (public)
router.get("/signup/:token", async (req, res) => {
  try {
    const [prop] = await db
      .select()
      .from(property)
      .where(eq(property.signupToken, req.params.token))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Invalid signup link" });

    // Get vacant rooms
    const vacantRooms = await db
      .select({
        id: room.id,
        number: room.number,
        type: room.type,
      })
      .from(room)
      .where(eq(room.propertyId, prop.id));

    res.json({
      propertyName: prop.name,
      rooms: vacantRooms,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signup data" });
  }
});

// Submit signup (public)
router.post("/signup/:token", async (req, res) => {
  try {
    const body = signupSchema.parse(req.body);

    const [prop] = await db
      .select()
      .from(property)
      .where(eq(property.signupToken, req.params.token))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Invalid signup link" });

    // Verify room belongs to property
    const [r] = await db
      .select()
      .from(room)
      .where(and(eq(room.id, body.roomId), eq(room.propertyId, prop.id)))
      .limit(1);

    if (!r) return res.status(404).json({ error: "Room not found" });

    // Check duplicate phone within this property
    const [existing] = await db
      .select()
      .from(tenant)
      .where(and(eq(tenant.phone, body.phone), eq(tenant.propertyId, prop.id)))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Phone already registered" });
    }

    // Self-registered tenants start pending: no bed is assigned and they do
    // not count toward occupancy until the owner approves them. The room
    // they asked for is remembered on requestedRoomId so approval knows where
    // to place them.
    const [newTenant] = await db
      .insert(tenant)
      .values({
        propertyId: prop.id,
        name: body.name,
        phone: body.phone,
        email: body.email,
        requestedRoomId: body.roomId,
        joiningDate: new Date(),
        status: "pending",
      })
      .returning();

    if (!newTenant) {
      return res.status(500).json({ error: "Failed to process signup" });
    }

    res.status(201).json({
      message: "Signup received. The owner will review and approve it shortly.",
      tenant: newTenant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to process signup" });
  }
});

// Get complaint form data (public)
router.get("/complaint/:token", async (req, res) => {
  try {
    const [prop] = await db
      .select()
      .from(property)
      .where(eq(property.complaintToken, req.params.token))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });

    res.json({ propertyName: prop.name });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaint data" });
  }
});

// Submit complaint (public)
router.post("/complaint/:token", async (req, res) => {
  try {
    const body = complaintSchema.parse(req.body);

    const [prop] = await db
      .select()
      .from(property)
      .where(eq(property.complaintToken, req.params.token))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });

    const [newComplaint] = await db
      .insert(complaint)
      .values({
        propertyId: prop.id,
        subject: body.subject,
        description: body.description,
        roomNumber: body.roomNumber,
        status: "open",
      })
      .returning();

    res.status(201).json({ message: "Complaint submitted", complaint: newComplaint });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

// Get onboarding status by token (public) — the private link an approved
// tenant is given, so they can see their placement without an account.
router.get("/onboarding/:token", async (req, res) => {
  try {
    const [t] = await db
      .select({
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        roomId: tenant.roomId,
        bedId: tenant.bedId,
        joiningDate: tenant.joiningDate,
      })
      .from(tenant)
      .where(eq(tenant.onboardingToken, req.params.token))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Invalid onboarding link" });

    let roomNumber: string | null = null;
    if (t.roomId) {
      const [r] = await db.select({ number: room.number }).from(room).where(eq(room.id, t.roomId)).limit(1);
      roomNumber = r?.number ?? null;
    }

    res.json({
      name: t.name,
      status: t.status,
      roomNumber,
      joiningDate: t.joiningDate,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch onboarding status" });
  }
});

export default router;
