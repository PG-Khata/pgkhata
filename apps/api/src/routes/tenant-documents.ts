import { Router } from "express";
import { z } from "zod";
import { db, tenantDocument, tenant } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { HttpError, param } from "../lib/http";
import { validateDocumentUpload } from "../lib/document-upload";
import { uploadToR2, deleteFromR2, isR2Configured } from "../lib/r2-storage";
import { pagination, sendPage } from "../lib/pagination";
import { presentPrivateDocument } from "../lib/private-document";

const router = Router({ mergeParams: true });

const uploadSchema = z.object({
  type: z.enum(["aadhaar", "pan", "passport", "driving_license", "other"]),
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z.string().min(1).max(100),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get documents for a tenant
router.get("/tenant/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
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
      .where(eq(tenantDocument.tenantId, tenantId))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, await Promise.all(documents.map((doc) => presentPrivateDocument(doc))), page);
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

    if (!isR2Configured()) throw new HttpError(503, "Document storage is temporarily unavailable");
    const validated = validateDocumentUpload(body);
    const result = await uploadToR2(
      `kyc/${tenantId}`,
      body.fileName,
      validated.buffer,
      validated.contentType,
      validated.extension,
    );

    let created: typeof tenantDocument.$inferSelect | undefined;
    try {
      [created] = await db.insert(tenantDocument).values({
          tenantId,
          type: body.type,
          fileName: body.fileName,
          fileUrl: "private",
          storageKey: result.key,
          contentType: validated.contentType,
          fileSize: result.size,
        }).returning();
    } catch (error) {
      await deleteFromR2(result.key).catch(() => undefined);
      throw error;
    }
    if (!created) throw new Error("Document insert returned no row");

    res.status(201).json(await presentPrivateDocument(created));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
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
    if (isR2Configured() && doc.tenant_document.storageKey) {
      try {
        await deleteFromR2(doc.tenant_document.storageKey);
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
