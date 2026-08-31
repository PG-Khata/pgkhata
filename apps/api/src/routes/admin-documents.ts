import { Router } from "express";
import { z } from "zod";
import { db, adminDocument } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { uploadToR2, deleteFromR2, isR2Configured } from "../lib/r2-storage";

const router = Router({ mergeParams: true });

const uploadSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["agreement", "license", "insurance", "other"]),
  fileName: z.string().min(1),
  fileUrl: z.string().url().optional(),
  fileBase64: z.string().optional(),
  contentType: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get documents for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const documents = await db
      .select()
      .from(adminDocument)
      .where(eq(adminDocument.propertyId, req.propertyId!));

    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Upload document
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = uploadSchema.parse(req.body);

    let fileUrl = body.fileUrl || "";
    let fileSize: number | null = null;

    if (isR2Configured() && body.fileBase64) {
      const buffer = Buffer.from(body.fileBase64, "base64");
      const contentType = body.contentType || "application/octet-stream";
      const result = await uploadToR2(`admin/${req.propertyId!}`, body.fileName, buffer, contentType);
      fileUrl = result.url;
      fileSize = result.size;
    } else if (!fileUrl) {
      return res.status(400).json({ error: "Either fileUrl or fileBase64 with R2 config required" });
    }

    const [created] = await db
      .insert(adminDocument)
      .values({
        propertyId: req.propertyId!,
        name: body.name,
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
      .from(adminDocument)
      .where(and(eq(adminDocument.id, documentId), eq(adminDocument.propertyId, req.propertyId!)))
      .limit(1);

    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (isR2Configured() && doc.fileUrl.includes("r2")) {
      try {
        const key = doc.fileUrl.split("/").slice(-3).join("/");
        await deleteFromR2(key);
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
