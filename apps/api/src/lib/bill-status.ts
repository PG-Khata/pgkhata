import { bill, db, tenant } from "@pgkhata/db";
import { and, inArray, isNull, sql } from "drizzle-orm";

/**
 * Persist effective overdue state on read boundaries. PostgreSQL evaluates
 * today's date in the business timezone, so host and database TZ cannot alter
 * the transition. Paid and voided bills are deliberately excluded.
 */
export async function reconcileOverdueStatuses(propertyIds: string[]): Promise<void> {
  if (propertyIds.length === 0) return;
  await db.update(bill).set({
    status: sql`case
      when ${bill.dueDate} < timezone('Asia/Kolkata', now())::date then 'overdue'
      when ${bill.paidAmount} > 0 then 'partial'
      else 'pending'
    end`,
    updatedAt: new Date(),
  }).where(and(
    isNull(bill.voidedAt),
    sql`${bill.balance} > 0`,
    inArray(
      bill.tenantId,
      db.select({ id: tenant.id }).from(tenant).where(inArray(tenant.propertyId, propertyIds)),
    ),
  ));
}
