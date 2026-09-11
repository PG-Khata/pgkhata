import { Router } from "express";
import { z } from "zod";
import { db, blogPost } from "@pgkhata/db";
import { eq, desc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { HttpError, param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";
import { isUniqueViolation } from "./errors";

const router = Router();

const postSchema = z.object({
  title: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens"),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  content: z.string().min(1),
  author: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  coverImage: z.string().trim().max(2000).nullable().optional(),
});

/** The slug is the public URL, so a collision is the caller's to resolve. */
const slugTaken = () => new HttpError(409, "A post with that slug already exists");

router.get("/blog/posts", async (_req, res) => {
  const posts = await db.select().from(blogPost).orderBy(desc(blogPost.createdAt));
  res.json(posts);
});

router.post("/blog/posts", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const [post] = await db
      .insert(blogPost)
      .values({
        ...parsed.data,
        excerpt: parsed.data.excerpt ?? null,
        coverImage: parsed.data.coverImage ?? null,
        // Whoever is signed in wrote it. The column default is one person's
        // name, which quietly misattributed every post anybody else published.
        author: parsed.data.author || req.user!.name,
        tags: parsed.data.tags ?? [],
      })
      .returning();

    res.status(201).json(post);
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken();
    throw error;
  }
});

router.get("/blog/posts/:postId", async (req: AuthenticatedRequest, res) => {
  const postId = param(req, "postId");
  const [post] = await db.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

router.put("/blog/posts/:postId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const postId = param(req, "postId");
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    // Read-then-write in one transaction so the audit `before` is the row this
    // statement actually replaced, not whatever it looked like a moment earlier.
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
      if (!before) return null;
      captureBefore(req, before);

      const [row] = await tx
        .update(blogPost)
        .set({
          ...parsed.data,
          excerpt: parsed.data.excerpt ?? null,
          coverImage: parsed.data.coverImage ?? null,
          author: parsed.data.author || before.author,
          tags: parsed.data.tags ?? [],
          updatedAt: new Date(),
        })
        .where(eq(blogPost.id, postId))
        .returning();
      return row ?? null;
    });

    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTaken();
    throw error;
  }
});

router.delete("/blog/posts/:postId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const postId = param(req, "postId");
  const [deleted] = await db.delete(blogPost).where(eq(blogPost.id, postId)).returning();
  if (!deleted) return res.status(404).json({ error: "Post not found" });

  // The deleted row IS the before image; a second read would be redundant.
  captureBefore(req, deleted);
  res.json({ success: true });
});

router.patch(
  "/blog/posts/:postId/publish",
  requireSuperAdminRole,
  async (req: AuthenticatedRequest, res) => {
    const postId = param(req, "postId");

    const [post] = await db.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });
    captureBefore(req, post);

    const nowPublishing = !post.published;
    const [updated] = await db
      .update(blogPost)
      .set({
        published: nowPublishing,
        publishedAt: nowPublishing ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(blogPost.id, postId))
      .returning();

    res.json(updated);
  },
);

export default router;
