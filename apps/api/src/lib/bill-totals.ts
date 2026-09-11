import { db, payment, bill } from "@pgkhata/db";
import { eq, sql } from "drizzle-orm";
import { aggregate, HttpError } from "./http";
import { isOverdue } from "./due-date";

/**
 * The transaction handle drizzle hands to `db.transaction(async (tx) => ...)`.
 * Derived from `db` rather than imported from drizzle internals so it tracks
 * the driver and schema without a second source of truth.
 */
export type BillTotalsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Recomputes bill totals from the payment ledger, the source of truth. */
export async function syncBillTotals(billId: string, totalAmount: number, tx?: BillTotalsTx) {
  const dbConn = tx || db;
  const { totalPaid } = aggregate(
    await dbConn
      .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)::int` })
      .from(payment)
      .where(eq(payment.billId, billId)),
    { totalPaid: 0 },
  );

  const [currentBill] = await dbConn
    .select({ dueDate: bill.dueDate, voidedAt: bill.voidedAt })
    .from(bill)
    .where(eq(bill.id, billId))
    .limit(1);
  if (!currentBill) throw new HttpError(404, "Bill not found");
  if (totalPaid > totalAmount) throw new HttpError(409, "Payments exceed bill total");

  const newBalance = currentBill.voidedAt ? 0 : totalAmount - totalPaid;
  const newStatus = currentBill.voidedAt
    ? "voided"
    : newBalance === 0
      ? "paid"
      : isOverdue(currentBill.dueDate)
        ? "overdue"
        : totalPaid > 0
          ? "partial"
          : "pending";

  await dbConn
    .update(bill)
    .set({
      paidAmount: totalPaid,
      balance: newBalance,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(bill.id, billId));

  return { totalPaid, balance: newBalance, status: newStatus };
}
