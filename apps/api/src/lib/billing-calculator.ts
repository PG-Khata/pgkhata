import { resolveMonthlyRent } from "./rent";

export interface BillLineItem {
  code: string;
  name: string;
  amount: number;
  /** Present for a metered electricity line; values are stored for invoices. */
  units?: number;
  ratePerUnit?: number;
}

export interface CalculatedBill {
  lineItems: BillLineItem[];
  totalAmount: number;
  rentAmount: number;
  electricityAmount: number;
}

export interface ElectricityInputs {
  /** Rupees per unit; null/undefined means the property does not meter. */
  ratePerUnit?: number | null;
  /** Units consumed, already resolved to the specific bill month — never
   * "whichever reading is newest," which bills the wrong month's usage. */
  unitsForMonth?: number | null;
  /** Active occupants of the room, for an even split. At least 1. */
  occupants: number;
  /**
   * A tenant's bed-day share of the reading period. When present this wins
   * over the legacy equal occupant split, so a mid-month move-in is charged
   * only for the days they actually occupied the room.
   */
  occupancyShare?: number | null;
}

export interface RecurringCharge {
  code: string;
  name: string;
  amount: number;
}

export interface BillCalculationInputs {
  rent: {
    tenantOverride?: number | null;
    bedRent?: number | null;
    planRent?: number | null;
    roomRent: number;
    /** Portion of the calendar month the tenant occupied the property. */
    proration?: number;
  };
  electricity: ElectricityInputs;
  /** Active, is_recurring charge types for the property, excluding ELEC —
   * electricity is always calculated from readings, never from a flat
   * default, even if a charge type row also carries a defaultAmount. */
  recurringCharges: RecurringCharge[];
}

/**
 * Builds one tenant's monthly bill as a list of line items, and the total is
 * always their sum — never a separately maintained column that can drift.
 *
 * Pure: no database access, so every rule is tested in isolation and the
 * route only has to wire real data into this shape.
 */
export function calculateBill(inputs: BillCalculationInputs): CalculatedBill {
  const lineItems: BillLineItem[] = [];

  const { amount: monthlyRent } = resolveMonthlyRent(inputs.rent);
  const rentAmount = Math.round(monthlyRent * Math.max(0, Math.min(1, inputs.rent.proration ?? 1)));
  lineItems.push({ code: "RENT", name: "Rent", amount: rentAmount });

  const electricityAmount = calculateElectricity(inputs.electricity);
  if (electricityAmount > 0 || inputs.electricity.ratePerUnit) {
    lineItems.push({
      code: "ELEC",
      name: "Electricity",
      amount: electricityAmount,
      units: Math.max(0, inputs.electricity.unitsForMonth ?? 0),
      ratePerUnit: Math.max(0, inputs.electricity.ratePerUnit ?? 0),
    });
  }

  for (const charge of inputs.recurringCharges) {
    lineItems.push({ code: charge.code, name: charge.name, amount: charge.amount });
  }

  const totalAmount = lineItems.reduce((sum, line) => sum + line.amount, 0);

  return { lineItems, totalAmount, rentAmount, electricityAmount };
}

/**
 * Electricity is zero, not skipped, when the property meters but no reading
 * exists for the month yet — the owner should see ₹0 and investigate, not see
 * the line item vanish and assume it was never metered at all.
 */
function calculateElectricity(inputs: ElectricityInputs): number {
  if (!inputs.ratePerUnit || !inputs.unitsForMonth) return 0;

  const share = inputs.occupancyShare ?? 1 / Math.max(1, inputs.occupants);
  return Math.round(inputs.unitsForMonth * inputs.ratePerUnit * Math.max(0, Math.min(1, share)));
}
