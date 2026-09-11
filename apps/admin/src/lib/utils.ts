export { cn } from "cn"

// Bill/payment amounts are integer rupees in the schema, so no /100 scaling here.
// Matches formatCurrency in apps/web/src/lib/utils.ts.
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}
