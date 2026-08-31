import { Router } from "express";
import { z } from "zod";
import { db, floor, room, bed } from "@pgkhata/db";
import { eq, and, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

// Export structure as JSON
router.get("/export", async (req: AuthenticatedRequest, res) => {
  try {
    const floors = await db
      .select()
      .from(floor)
      .where(eq(floor.propertyId, req.propertyId!));

    const rooms = await db
      .select()
      .from(room)
      .where(eq(room.propertyId, req.propertyId!));

    const roomIds = rooms.map((r) => r.id);
    const beds = roomIds.length > 0
      ? await db.select().from(bed).where(inArray(bed.roomId, roomIds))
      : [];

    // Build hierarchical structure
    const structure = floors.map((f) => ({
      floor: f.name,
      position: f.position,
      rooms: rooms
        .filter((r) => r.floorId === f.id)
        .map((r) => ({
          number: r.number,
          type: r.type,
          capacity: r.capacity,
          monthlyRent: r.monthlyRent,
          beds: beds
            .filter((b) => b.roomId === r.id)
            .map((b) => ({
              number: b.number,
              status: b.status,
              monthlyRent: b.monthlyRent,
            })),
        })),
    }));

    // Add unassigned rooms
    const unassignedRooms = rooms.filter((r) => !r.floorId);
    if (unassignedRooms.length > 0) {
      structure.push({
        floor: "Unassigned",
        position: 999,
        rooms: unassignedRooms.map((r) => ({
          number: r.number,
          type: r.type,
          capacity: r.capacity,
          monthlyRent: r.monthlyRent,
          beds: beds
            .filter((b) => b.roomId === r.id)
            .map((b) => ({
              number: b.number,
              status: b.status,
              monthlyRent: b.monthlyRent,
            })),
        })),
      });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=structure.json");
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: "Failed to export structure" });
  }
});

// Import structure from JSON
router.post("/import", async (req: AuthenticatedRequest, res) => {
  try {
    const importSchema = z.array(
      z.object({
        floor: z.string(),
        position: z.number().optional(),
        rooms: z.array(
          z.object({
            number: z.string(),
            type: z.enum(["single", "double", "triple", "dormitory"]).default("single"),
            capacity: z.number().min(1).default(1),
            monthlyRent: z.number().min(0).default(0),
            beds: z
              .array(
                z.object({
                  number: z.string(),
                  monthlyRent: z.number().min(0).optional(),
                }),
              )
              .optional(),
          }),
        ),
      }),
    );

    const structure = importSchema.parse(req.body);

    const results = await db.transaction(async (tx) => {
      let floorsCreated = 0;
      let roomsCreated = 0;
      let bedsCreated = 0;

      for (const floorData of structure) {
        // Create floor
        const [f] = await tx
          .insert(floor)
          .values({
            propertyId: req.propertyId!,
            name: floorData.floor,
            position: floorData.position ?? floorsCreated,
          })
          .returning();
        floorsCreated++;

        if (!f) continue;

        for (const roomData of floorData.rooms) {
          // Create room
          const [r] = await tx
            .insert(room)
            .values({
              propertyId: req.propertyId!,
              floorId: f.id,
              number: roomData.number,
              type: roomData.type,
              capacity: roomData.capacity,
              monthlyRent: roomData.monthlyRent,
            })
            .returning();
          roomsCreated++;

          if (!r) continue;

          // Create beds
          const bedCount = roomData.beds?.length ?? roomData.capacity;
          for (let i = 0; i < bedCount; i++) {
            const bedNumber = roomData.beds?.[i]?.number ?? String.fromCharCode(65 + i);
            await tx.insert(bed).values({
              roomId: r.id,
              number: bedNumber,
              monthlyRent: roomData.beds?.[i]?.monthlyRent,
            });
            bedsCreated++;
          }
        }
      }

      return { floorsCreated, roomsCreated, bedsCreated };
    });

    res.status(201).json({
      message: `Imported ${results.floorsCreated} floors, ${results.roomsCreated} rooms, ${results.bedsCreated} beds`,
      ...results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to import structure" });
  }
});

export default router;
