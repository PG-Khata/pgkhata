import { Router } from "express";
import { z } from "zod";
import { db, tenantDocument, tenant } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { uploadToR2, deleteFromR2, isR2Configured } from "../lib/r2-storage";

const router = Router({ mergeParams: true });

const uploadSchema = z.object({
  type: z.enum(["aadhaar", "pan", "passport", "driving_license", "other"]),
  fileName: z.string().min(1),
  fileUrl: z.string().url().optional(), // Direct URL if not using R2
  fileBase64: z.string().optional(), // Base64 encoded file for R2 upload
  contentType: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get documents for a tenant
router.get("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    const documents = await db
      .select()
      .from(tenantDocument)
      .where(eq(tenantDocument.tenantId, tenantId));

    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Upload document
router.post("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const body = uploadSchema.parse(req.body);

    const [t] = await db
      .select({ id: tenant.id })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });

    let fileUrl = body.fileUrl || "";
    let fileSize: number | null = null;

    // If R2 is configured and base64 is provided, upload to R2
    if (isR2Configured() && body.fileBase64) {
      const buffer = Buffer.from(body.fileBase64, "base64");
      const contentType = body.contentType || "application/octet-stream";
      const result = await uploadToR2(`kyc/${tenantId}`, body.fileName, buffer, contentType);
      fileUrl = result.url;
      fileSize = result.size;
    } else if (!fileUrl) {
      return res.status(400).json({ error: "Either fileUrl or fileBase64 with R2 config required" });
    }

    const [created] = await db
      .insert(tenantDocument)
      .values({
        tenantId,
        type: body.type,
        fileName: body.fileName,
        fileUrl,
        fileSize,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// Delete document
router.delete("/:documentId", async (req: AuthenticatedRequest, res) => {
  try {
    const documentId = param(req, "documentId");

    const [doc] = await db
      .select()
      .from(tenantDocument)
      .innerJoin(tenant, eq(tenantDocument.tenantId, tenant.id))
      .where(and(eq(tenantDocument.id, documentId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Try to delete from R2 if configured
    if (isR2Configured() && doc.tenant_document.fileUrl.includes("r2")) {
      try {
        const key = doc.tenant_document.fileUrl.split("/").slice(-3).join("/");
        await deleteFromR2(key);
      } catch {
        // Ignore R2 deletion errors - document record will still be deleted
      }
    }

    await db.delete(tenantDocument).where(eq(tenantDocument.id, documentId));

    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
