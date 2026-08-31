export interface BillForAllocation {
  id: string;
  balance: number;
  billMonth: string;
}

export interface AllocationResult {
  billId: string;
  amount: number;
}

export function autoAllocatePayment(
  amount: number,
  bills: BillForAllocation[],
): AllocationResult[] {
  // Sort oldest first
  const sorted = [...bills].sort((a, b) => a.billMonth.localeCompare(b.billMonth));

  const allocations: AllocationResult[] = [];
  let remaining = amount;

  for (const b of sorted) {
    if (remaining <= 0) break;
    if (b.balance <= 0) continue;

    const allocation = Math.min(remaining, b.balance);
    allocations.push({ billId: b.id, amount: allocation });
    remaining -= allocation;
  }

  return allocations;
}
