import { Router } from "express";
import { db, tenant, bill, expense, securityDeposit, room, bed } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { toCsv } from "../lib/csv";

const router = Router({ mergeParams: true });
const MAX_EXPORT_ROWS = 10_000;

router.use(requireAuth, requireOwner, requireProperty);

// Export tenants as CSV
router.get("/tenants", async (req: AuthenticatedRequest, res) => {
  try {
    const tenants = await db
      .select({
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        status: tenant.status,
        roomNumber: room.number,
        bedNumber: bed.number,
        joiningDate: tenant.joiningDate,
      })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .where(eq(tenant.propertyId, req.propertyId!))
      .limit(MAX_EXPORT_ROWS + 1);

    if (tenants.length > MAX_EXPORT_ROWS) {
      return res.status(413).json({ error: `Export exceeds ${MAX_EXPORT_ROWS} rows` });
    }

    const csv = toCsv(
      ["Name", "Phone", "Email", "Status", "Room", "Bed", "Joining Date"],
      tenants.map((t) => [
        t.name,
        t.phone,
        t.email ?? "",
        t.status,
        t.roomNumber ?? "",
        t.bedNumber ?? "",
        t.joiningDate ? new Date(t.joiningDate).toISOString().split("T")[0] : "",
      ]),
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tenants.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export tenants" });
  }
});

// Export expenses as CSV
router.get("/expenses", async (req: AuthenticatedRequest, res) => {
  try {
    const expenses = await db
      .select({
        date: expense.date,
        amount: expense.amount,
        description: expense.description,
        status: expense.status,
      })
      .from(expense)
      .where(eq(expense.propertyId, req.propertyId!))
      .limit(MAX_EXPORT_ROWS + 1);

    if (expenses.length > MAX_EXPORT_ROWS) {
      return res.status(413).json({ error: `Export exceeds ${MAX_EXPORT_ROWS} rows` });
    }

    const csv = toCsv(
      ["Date", "Amount", "Description", "Status"],
      expenses.map((e) => [
        e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        e.amount,
        e.description,
        e.status,
      ]),
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=expenses.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export expenses" });
  }
});

export default router;
