import { Router } from "express";
import {
  db,
  user,
  ownerProfile,
  property,
  tenant,
  bill,
  payment,
  floor,
  room,
  bed,
  blogPost,
} from "@pgkhata/db";
import { eq, sql, desc, ilike, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { requireSuperAdmin } from "../middleware/admin";
import { param } from "../lib/http";

const router = Router();

// ──────────────────────────────────────────────
// Platform overview / analytics
// ──────────────────────────────────────────────

router.get("/analytics", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const [[{ userCount }], [{ ownerCount }], [{ propertyCount }], [{ tenantCount }]] =
      await Promise.all([
        db.select({ userCount: sql<number>`count(*)::int` }).from(user),
        db.select({ ownerCount: sql<number>`count(*)::int` }).from(ownerProfile),
        db.select({ propertyCount: sql<number>`count(*)::int` }).from(property),
        db
          .select({ tenantCount: sql<number>`count(*)::int` })
          .from(tenant)
          .where(eq(tenant.status, "active")),
      ]);

    res.json({ totalUsers: userCount, totalOwners: ownerCount, totalProperties: propertyCount, activeTenants: tenantCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ──────────────────────────────────────────────
// Owners
// ──────────────────────────────────────────────

router.get("/owners", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const owners = await db
      .select({
        owner: ownerProfile,
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .orderBy(desc(ownerProfile.createdAt));

    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});

router.get("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = param(req, "ownerId");

    const [owner] = await db
      .select({
        owner: ownerProfile,
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(eq(ownerProfile.id, ownerId))
      .limit(1);

    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const properties = await db.select().from(property).where(eq(property.ownerId, ownerId));

    res.json({ ...owner, properties });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owner" });
  }
});

router.put("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = param(req, "ownerId");
    const { phone } = req.body;

    const [updated] = await db
      .update(ownerProfile)
      .set({ phone, updatedAt: new Date() })
      .where(eq(ownerProfile.id, ownerId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Owner not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update owner" });
  }
});

router.delete("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = param(req, "ownerId");
    const [deleted] = await db.delete(ownerProfile).where(eq(ownerProfile.id, ownerId)).returning();
    if (!deleted) return res.status(404).json({ error: "Owner not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete owner" });
  }
});

// ──────────────────────────────────────────────
// Properties (cross-owner)
// ──────────────────────────────────────────────

router.get("/properties", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const properties = await db
      .select({
        property: property,
        ownerName: user.name,
      })
      .from(property)
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .orderBy(desc(property.createdAt));

    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

router.get("/properties/:propertyId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");

    const [prop] = await db
      .select({
        property: property,
        ownerName: user.name,
      })
      .from(property)
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(eq(property.id, propertyId))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    const [[{ totalBeds }], [{ occupiedBeds }], [{ activeTenants }]] = await Promise.all([
      db.select({ totalBeds: sql<number>`count(*)::int` }).from(bed).innerJoin(room, eq(bed.roomId, room.id)).where(eq(room.propertyId, propertyId)),
      db.select({ occupiedBeds: sql<number>`count(*)::int` }).from(bed).innerJoin(room, eq(bed.roomId, room.id)).where(and(eq(room.propertyId, propertyId), eq(bed.status, "occupied"))),
      db.select({ activeTenants: sql<number>`count(*)::int` }).from(tenant).where(and(eq(tenant.propertyId, propertyId), eq(tenant.status, "active"))),
    ]);

    res.json({ ...prop.property, ownerName: prop.ownerName, totalBeds, occupiedBeds, activeTenants });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

router.put("/properties/:propertyId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");
    const { name, address, city, state, pincode, electricityMode, electricityRatePerUnit, upiVpa } = req.body;

    const [updated] = await db
      .update(property)
      .set({ name, address, city, state, pincode, electricityMode, electricityRatePerUnit, upiVpa, updatedAt: new Date() })
      .where(eq(property.id, propertyId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Property not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update property" });
  }
});

router.delete("/properties/:propertyId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");
    const [deleted] = await db.delete(property).where(eq(property.id, propertyId)).returning();
    if (!deleted) return res.status(404).json({ error: "Property not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete property" });
  }
});

// ──────────────────────────────────────────────
// Tenants (cross-property)
// ──────────────────────────────────────────────

router.get("/tenants", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const tenants = await db
      .select({
        tenant: tenant,
        propertyName: property.name,
        ownerName: user.name,
      })
      .from(tenant)
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .orderBy(desc(tenant.createdAt));

    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

router.get("/tenants/:tenantId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [t] = await db
      .select({
        tenant: tenant,
        propertyName: property.name,
        ownerName: user.name,
      })
      .from(tenant)
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(eq(tenant.id, tenantId))
      .limit(1);

    if (!t) return res.status(404).json({ error: "Tenant not found" });
    res.json(t);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

router.put("/tenants/:tenantId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const { name, phone, email, occupation, notes } = req.body;

    const [updated] = await db
      .update(tenant)
      .set({ name, phone, email, occupation, notes, updatedAt: new Date() })
      .where(eq(tenant.id, tenantId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

router.post("/tenants/:tenantId/approve", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [updated] = await db
      .update(tenant)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(tenant.id, tenantId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve tenant" });
  }
});

router.post("/tenants/:tenantId/reject", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [updated] = await db
      .update(tenant)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(tenant.id, tenantId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to reject tenant" });
  }
});

router.delete("/tenants/:tenantId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [deleted] = await db.delete(tenant).where(eq(tenant.id, tenantId)).returning();
    if (!deleted) return res.status(404).json({ error: "Tenant not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// ──────────────────────────────────────────────
// Billing (cross-property)
// ──────────────────────────────────────────────

router.get("/bills", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const bills = await db
      .select({
        bill: bill,
        tenantName: tenant.name,
        propertyName: property.name,
      })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .orderBy(desc(bill.createdAt));

    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

router.get("/bills/:billId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");

    const [b] = await db
      .select({
        bill: bill,
        tenantName: tenant.name,
        propertyName: property.name,
      })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(eq(bill.id, billId))
      .limit(1);

    if (!b) return res.status(404).json({ error: "Bill not found" });
    res.json(b);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});

router.patch("/bills/:billId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");
    const { totalAmount, paidAmount, balance, status } = req.body;

    const [updated] = await db
      .update(bill)
      .set({ totalAmount, paidAmount, balance, status, updatedAt: new Date() })
      .where(eq(bill.id, billId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Bill not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bill" });
  }
});

router.post("/bills/:billId/void", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");
    const [updated] = await db
      .update(bill)
      .set({ voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(bill.id, billId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Bill not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to void bill" });
  }
});

// ──────────────────────────────────────────────
// Payments (cross-property)
// ──────────────────────────────────────────────

router.get("/payments", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const payments = await db
      .select({
        payment: payment,
        tenantName: tenant.name,
        billMonth: bill.billMonth,
      })
      .from(payment)
      .leftJoin(bill, eq(payment.billId, bill.id))
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .orderBy(desc(payment.createdAt));

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.put("/payments/:paymentId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = param(req, "paymentId");
    const { amount, paymentDate, method, notes } = req.body;

    const [updated] = await db
      .update(payment)
      .set({ amount, paymentDate, method, notes })
      .where(eq(payment.id, paymentId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Payment not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update payment" });
  }
});

router.delete("/payments/:paymentId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = param(req, "paymentId");
    const [deleted] = await db.delete(payment).where(eq(payment.id, paymentId)).returning();
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

// ──────────────────────────────────────────────
// Structure (read-only)
// ──────────────────────────────────────────────

router.get("/properties/:propertyId/floors", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");
    const floors = await db.select().from(floor).where(eq(floor.propertyId, propertyId)).orderBy(floor.position);
    res.json(floors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch floors" });
  }
});

router.get("/properties/:propertyId/rooms", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");
    const rooms = await db.select().from(room).where(eq(room.propertyId, propertyId));
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

router.get("/properties/:propertyId/beds", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const propertyId = param(req, "propertyId");
    const beds = await db
      .select({ bed: bed, roomNumber: room.number })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(eq(room.propertyId, propertyId));
    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch beds" });
  }
});

router.patch("/beds/:bedId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const bedId = param(req, "bedId");
    const { status, monthlyRent } = req.body;

    const [updated] = await db
      .update(bed)
      .set({ status, monthlyRent, updatedAt: new Date() })
      .where(eq(bed.id, bedId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Bed not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bed" });
  }
});

// ──────────────────────────────────────────────
// Impersonation
// ──────────────────────────────────────────────

// In-memory store for impersonation tokens (replace with Redis in production)
const impersonationTokens = new Map<string, { adminId: string; ownerId: string; ownerName: string; expiresAt: number }>();

router.post("/owners/:ownerId/impersonate", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = param(req, "ownerId");

    const [owner] = await db
      .select({ owner: ownerProfile, userName: user.name })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(eq(ownerProfile.id, ownerId))
      .limit(1);

    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const token = `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    impersonationTokens.set(token, {
      adminId: req.user!.id,
      ownerId,
      ownerName: owner.userName,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
    });

    res.json({ token, ownerName: owner.userName });
  } catch (error) {
    res.status(500).json({ error: "Failed to create impersonation token" });
  }
});

router.post("/impersonate/exit", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const token = req.headers["x-impersonate-owner"] as string;
  if (token) impersonationTokens.delete(token);
  res.json({ success: true });
});

router.get("/impersonate/status", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const token = req.headers["x-impersonate-token"] as string;
  if (!token) return res.json({ impersonating: false });

  const session = impersonationTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.json({ impersonating: false });
  }

  res.json({ impersonating: true, ownerId: session.ownerId, ownerName: session.ownerName });
});

// ──────────────────────────────────────────────
// Blog (CRUD)
// ──────────────────────────────────────────────

router.get("/blog/posts", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const posts = await db.select().from(blogPost).orderBy(desc(blogPost.createdAt));
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

router.post("/blog/posts", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, slug, excerpt, content, author, tags, coverImage } = req.body;

    const [post] = await db
      .insert(blogPost)
      .values({ title, slug, excerpt, content, author: author || "Mukund Jha", tags: tags || [], coverImage })
      .returning();

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to create blog post" });
  }
});

router.get("/blog/posts/:postId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = param(req, "postId");
    const [post] = await db.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

router.put("/blog/posts/:postId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = param(req, "postId");
    const { title, slug, excerpt, content, author, tags, coverImage } = req.body;

    const [updated] = await db
      .update(blogPost)
      .set({ title, slug, excerpt, content, author, tags, coverImage, updatedAt: new Date() })
      .where(eq(blogPost.id, postId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update blog post" });
  }
});

router.delete("/blog/posts/:postId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = param(req, "postId");
    const [deleted] = await db.delete(blogPost).where(eq(blogPost.id, postId)).returning();
    if (!deleted) return res.status(404).json({ error: "Post not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete blog post" });
  }
});

router.patch("/blog/posts/:postId/publish", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = param(req, "postId");

    const [post] = await db.select().from(blogPost).where(eq(blogPost.id, postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });

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
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle publish" });
  }
});

export default router;
