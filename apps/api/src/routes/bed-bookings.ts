import { Router } from "express";
import { z } from "zod";
import { db, bedBooking, bed, room, tenant } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { assignTenantToBed } from "../lib/tenant-assignment";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  bedId: z.string().uuid(),
  tenantName: z.string().min(1).max(100),
  tenantPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  notes: z.string().optional(),
  expiryDays: z.number().min(1).max(30).optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get bookings for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const bookings = await db
      .select({
        booking: bedBooking,
        bedNumber: bed.number,
        roomNumber: room.number,
      })
      .from(bedBooking)
      .innerJoin(bed, eq(bedBooking.bedId, bed.id))
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(eq(room.propertyId, req.propertyId!));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Create booking
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Verify bed belongs to property
    const [b] = await db
      .select({ id: bed.id, status: bed.status })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(and(eq(bed.id, body.bedId), eq(room.propertyId, req.propertyId!)))
      .limit(1);

    if (!b) return res.status(404).json({ error: "Bed not found" });
    if (b.status !== "vacant") return res.status(409).json({ error: "Bed is not vacant" });

    const expiryDate = body.expiryDays
      ? new Date(Date.now() + body.expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const [created] = await db
      .insert(bedBooking)
      .values({
        bedId: body.bedId,
        tenantName: body.tenantName,
        tenantPhone: body.tenantPhone,
        notes: body.notes,
        expiryDate,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Cancel booking
router.post("/:bookingId/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    const bookingId = param(req, "bookingId");

    const [updated] = await db
      .update(bedBooking)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(bedBooking.id, bookingId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Booking not found" });

    res.json({ message: "Booking cancelled", booking: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// Convert booking to check-in
router.post("/:bookingId/convert", async (req: AuthenticatedRequest, res) => {
  try {
    const bookingId = param(req, "bookingId");

    const [booking] = await db
      .select()
      .from(bedBooking)
      .where(eq(bedBooking.id, bookingId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return res.status(409).json({ error: "Booking cannot be converted" });
    }

    // Create tenant as pending
    const [newTenant] = await db
      .insert(tenant)
      .values({
        propertyId: req.propertyId!,
        name: booking.tenantName,
        phone: booking.tenantPhone,
        status: "pending",
        requestedRoomId: null,
        joiningDate: new Date(),
      })
      .returning();

    // Mark booking as converted
    await db
      .update(bedBooking)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(bedBooking.id, bookingId));

    res.status(201).json({
      message: "Booking converted to tenant (pending approval)",
      tenant: newTenant,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to convert booking" });
  }
});

export default router;
