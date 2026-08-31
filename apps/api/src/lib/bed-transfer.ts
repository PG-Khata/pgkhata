export interface TransferValidation {
  ok: boolean;
  reason?: string;
}

export function validateTransfer(
  currentBedId: string | null,
  newBedId: string,
  newBedStatus: string,
): TransferValidation {
  if (!currentBedId) {
    return { ok: false, reason: "Tenant has no bed to transfer from" };
  }
  if (currentBedId === newBedId) {
    return { ok: false, reason: "Tenant is already in this bed" };
  }
  if (newBedStatus !== "vacant") {
    return { ok: false, reason: "Target bed is not vacant" };
  }
  return { ok: true };
}
