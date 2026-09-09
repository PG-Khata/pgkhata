import { Router } from "express";
import { z } from "zod";
import { db, adminDocument } from "@pgkhata/db";
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
  name: z.string().min(1).max(200),
  type: z.enum(["agreement", "license", "insurance", "other"]),
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z.string().min(1).max(100),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get documents for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    const documents = await db
      .select()
      .from(adminDocument)
      .where(eq(adminDocument.propertyId, req.propertyId!))
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, await Promise.all(documents.map((doc) => presentPrivateDocument(doc))), page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Upload document
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = uploadSchema.parse(req.body);

    if (!isR2Configured()) throw new HttpError(503, "Document storage is temporarily unavailable");
    const validated = validateDocumentUpload(body);
    const result = await uploadToR2(
      `admin/${req.propertyId!}`,
      body.fileName,
      validated.buffer,
      validated.contentType,
      validated.extension,
    );

    let created: typeof adminDocument.$inferSelect | undefined;
    try {
      [created] = await db.insert(adminDocument).values({
          propertyId: req.propertyId!,
          name: body.name,
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
      .from(adminDocument)
      .where(and(eq(adminDocument.id, documentId), eq(adminDocument.propertyId, req.propertyId!)))
      .limit(1);

    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (isR2Configured() && doc.storageKey) {
      try {
        await deleteFromR2(doc.storageKey);
      } catch {
        // Ignore R2 deletion errors
      }
    }

    await db.delete(adminDocument).where(eq(adminDocument.id, documentId));

    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
