export interface CheckoutPreviewInput {
  outstandingBills: { totalAmount: number; paidAmount: number; balance: number }[];
  securityDeposit: { amount: number; refundAmount: number; status: string } | null;
  advancePayments: { amount: number; appliedAmount: number; status: string }[];
}

export interface CheckoutPreviewResult {
  totalOutstanding: number;
  depositHeld: number;
  depositToRefund: number;
  advanceBalance: number;
  netSettlement: number; // positive = owner owes tenant, negative = tenant owes owner
}

export function calculateCheckoutPreview(input: CheckoutPreviewInput): CheckoutPreviewResult {
  const totalOutstanding = input.outstandingBills.reduce((sum, b) => sum + b.balance, 0);

  const depositHeld = input.securityDeposit?.status !== "refunded"
    ? (input.securityDeposit?.amount ?? 0) - (input.securityDeposit?.refundAmount ?? 0)
    : 0;

  const advanceBalance = input.advancePayments
    .filter((a) => a.status === "available")
    .reduce((sum, a) => sum + (a.amount - a.appliedAmount), 0);

  // Net settlement: deposit + advances - outstanding
  // Positive = owner owes tenant, Negative = tenant owes owner
  const netSettlement = depositHeld + advanceBalance - totalOutstanding;

  return {
    totalOutstanding,
    depositHeld,
    depositToRefund: Math.max(0, netSettlement),
    advanceBalance,
    netSettlement,
  };
}
