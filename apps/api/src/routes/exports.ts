import { Router } from "express";
import { db, tenant, bill, expense, securityDeposit, room, bed } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

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
      .where(eq(tenant.propertyId, req.propertyId!));

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
      .where(eq(expense.propertyId, req.propertyId!));

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
