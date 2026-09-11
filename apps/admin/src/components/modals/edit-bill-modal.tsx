"use client";

import { useState } from "react";
import { useUpdateAdminBill } from "@/hooks/use-admin-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AdminBill } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: AdminBill;
}

function formatINR(amount: number) {
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export function EditBillModal({ open, onOpenChange, bill }: Props) {
  const updateBill = useUpdateAdminBill(bill.id);
  const [totalAmount, setTotalAmount] = useState((bill.totalAmount / 100).toString());
  const [paidAmount, setPaidAmount] = useState((bill.paidAmount / 100).toString());
  const [balance, setBalance] = useState((bill.balance / 100).toString());
  const [status, setStatus] = useState(bill.status);

  function handleSave() {
    const total = Math.round(parseFloat(totalAmount) * 100);
    const paid = Math.round(parseFloat(paidAmount) * 100);
    const bal = Math.round(parseFloat(balance) * 100);

    updateBill.mutate(
      { totalAmount: total, paidAmount: paid, balance: bal, status },
      {
        onSuccess: () => {
          toast.success("Bill updated");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Bill — {bill.billMonth}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Tenant:</span>{" "}
            <span className="font-medium">{bill.tenantName || "Unknown"}</span>
            {bill.propertyName && (
              <>
                <span className="text-muted-foreground"> · Property:</span> {bill.propertyName}
              </>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Total Amount (₹)</label>
              <Input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Paid Amount (₹)</label>
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Balance (₹)</label>
              <Input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: Changes here override automatic calculations. Use with caution.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateBill.isPending}>
            {updateBill.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
