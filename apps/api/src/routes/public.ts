import { Router } from "express";
import { z } from "zod";
import { db, property, room, tenant, tenantDocument, complaint, bill } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { validateDocumentUpload } from "../lib/document-upload";
import { deleteFromR2, uploadToR2, isR2Configured } from "../lib/r2-storage";
import { HttpError } from "../lib/http";
import { randomUUID } from "node:crypto";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  email: z.string().email().optional(),
  alternatePhone: z.string().regex(/^\d{10}$/, "Must be 10 digits").optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  occupation: z.string().max(100).optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Must be 12 digits").optional().or(z.literal("")),
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format").optional().or(z.literal("")),
  permanentAddress: z.string().optional(),
  permanentAddressCity: z.string().optional(),
  permanentAddressState: z.string().optional(),
  permanentAddressPincode: z.string().regex(/^\d{6}$/, "Must be 6 digits").optional().or(z.literal("")),
  roomId: z.string().uuid(),
  documents: z.array(z.object({
    type: z.enum(["aadhaar", "pan", "passport", "driving_license", "other"]),
    fileName: z.string().min(1).max(255),
    fileBase64: z.string().min(1),
    contentType: z.string().min(1).max(100),
  })).min(1, "At least one ID proof document is required").max(5),
});

const complaintSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  roomId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  category: z.enum(["plumbing", "electrical", "cleaning", "maintenance", "security", "other"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
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

    const rooms = await db
      .select({
        id: room.id,
        number: room.number,
        type: room.type,
      })
      .from(room)
      .where(eq(room.propertyId, prop.id));

    res.json({
      propertyName: prop.name,
      rooms,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signup data" });
  }
});

// Capability-token invoice view. Deliberately selects only tenant-facing bill
// fields, never property ownership or dashboard data.
router.get("/invoice/:token", async (req, res) => {
  try {
    const [row] = await db.select({ bill: bill, tenantName: tenant.name, propertyName: property.name, roomNumber: room.number, upiVpa: property.upiVpa })
      .from(bill).innerJoin(tenant, eq(bill.tenantId, tenant.id)).innerJoin(property, eq(tenant.propertyId, property.id))
      .leftJoin(room, eq(tenant.roomId, room.id)).where(eq(bill.accessToken, req.params.token)).limit(1);
    if (!row || row.bill.voidedAt) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice: { month: row.bill.billMonth, lineItems: row.bill.lineItems, totalAmount: row.bill.totalAmount, paidAmount: row.bill.paidAmount, balance: row.bill.balance, status: row.bill.status, dueDate: row.bill.dueDate, tenantName: row.tenantName, propertyName: row.propertyName, roomNumber: row.roomNumber, upiVpa: row.upiVpa } });
  } catch { res.status(500).json({ error: "Failed to fetch invoice" }); }
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

    if (!isR2Configured()) {
      return res.status(503).json({ error: "Document uploads are temporarily unavailable" });
    }

    const validatedDocuments = body.documents.map(validateDocumentUpload);

    const tenantId = randomUUID();
    const uploadedDocuments: Array<{ key: string; size: number }> = [];
    try {
      for (const [index, document] of body.documents.entries()) {
        const validated = validatedDocuments[index]!;
        uploadedDocuments.push(await uploadToR2(
          `kyc/${tenantId}`,
          document.fileName,
          validated.buffer,
          validated.contentType,
          validated.extension,
        ));
      }

      // The tenant and every document row commit together. Uploads happen
      // first and are compensating-deleted if storage or PostgreSQL fails, so
      // an external outage cannot leave a half-created onboarding record.
      const newTenant = await db.transaction(async (tx) => {
        const [created] = await tx.insert(tenant).values({
          id: tenantId,
          propertyId: prop.id,
          name: body.name,
          phone: body.phone,
          email: body.email,
          alternatePhone: body.alternatePhone || null,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          gender: body.gender || null,
          occupation: body.occupation || null,
          aadhaarNumber: body.aadhaarNumber || null,
          panNumber: body.panNumber || null,
          permanentAddress: body.permanentAddress || null,
          permanentAddressCity: body.permanentAddressCity || null,
          permanentAddressState: body.permanentAddressState || null,
          permanentAddressPincode: body.permanentAddressPincode || null,
          requestedRoomId: body.roomId,
          joiningDate: new Date(),
          status: "pending",
        }).returning();
        if (!created) throw new Error("Tenant insert returned no row");

        if (body.documents.length > 0) {
          await tx.insert(tenantDocument).values(body.documents.map((document, index) => ({
            tenantId,
            type: document.type,
            fileName: document.fileName,
            fileUrl: "private",
            storageKey: uploadedDocuments[index]!.key,
            contentType: validatedDocuments[index]!.contentType,
            fileSize: uploadedDocuments[index]!.size,
          })));
        }
        return created;
      });

      res.status(201).json({
        message: "Signup received. The owner will review and approve it shortly.",
        tenant: newTenant,
      });
      return;
    } catch (error) {
      await Promise.allSettled(uploadedDocuments.map((document) => deleteFromR2(document.key)));
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
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

    // Get rooms with tenants for this property
    const roomsWithTenants = await db
      .select({
        roomId: room.id,
        roomNumber: room.number,
        tenantId: tenant.id,
        tenantName: tenant.name,
      })
      .from(room)
      .leftJoin(tenant, and(
        eq(tenant.roomId, room.id),
        eq(tenant.status, "active")
      ))
      .where(eq(room.propertyId, prop.id))
      .orderBy(room.number);

    // Group by room
    const rooms = roomsWithTenants.reduce((acc, row) => {
      const existing = acc.find(r => r.roomId === row.roomId);
      if (existing) {
        if (row.tenantId) {
          existing.tenants.push({
            id: row.tenantId,
            name: row.tenantName,
          });
        }
      } else {
        acc.push({
          id: row.roomId,
          number: row.roomNumber,
          tenants: row.tenantId ? [{
            id: row.tenantId,
            name: row.tenantName,
          }] : [],
        });
      }
      return acc;
    }, [] as any[]);

    res.json({ propertyName: prop.name, rooms });
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

    const [selectedRoom] = await db
      .select({ id: room.id, number: room.number })
      .from(room)
      .where(and(eq(room.id, body.roomId), eq(room.propertyId, prop.id)))
      .limit(1);

    if (!selectedRoom) return res.status(404).json({ error: "Room not found" });

    if (body.tenantId) {
      const [selectedTenant] = await db
        .select({ id: tenant.id })
        .from(tenant)
        .where(and(
          eq(tenant.id, body.tenantId),
          eq(tenant.propertyId, prop.id),
          eq(tenant.roomId, selectedRoom.id),
          eq(tenant.status, "active"),
        ))
        .limit(1);

      if (!selectedTenant) return res.status(400).json({ error: "Tenant does not belong to this room" });
    }

    const [newComplaint] = await db
      .insert(complaint)
      .values({
        propertyId: prop.id,
        tenantId: body.tenantId || null,
        subject: body.subject,
        description: body.description,
        roomNumber: selectedRoom.number,
        category: body.category || "other",
        priority: body.priority || "medium",
        status: "open",
      })
      .returning();

    res.status(201).json({ message: "Complaint submitted", complaint: newComplaint });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
