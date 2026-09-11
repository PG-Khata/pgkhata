"use client";

import { useState } from "react";
import { useUpdateAdminPayment } from "@/hooks/use-admin-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AdminPayment } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: AdminPayment;
}

export function EditPaymentModal({ open, onOpenChange, payment }: Props) {
  const updatePayment = useUpdateAdminPayment(payment.id);
  const [amount, setAmount] = useState((payment.amount / 100).toString());
  const [paymentDate, setPaymentDate] = useState(payment.paymentDate.split("T")[0]);
  const [method, setMethod] = useState(payment.method ?? "cash");
  const [notes, setNotes] = useState(payment.notes ?? "");

  function handleSave() {
    updatePayment.mutate(
      {
        amount: Math.round(parseFloat(amount) * 100),
        paymentDate,
        method,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Payment updated");
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
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Tenant:</span>{" "}
            <span className="font-medium">{payment.tenantName || "Unknown"}</span>
            {payment.billMonth && (
              <>
                <span className="text-muted-foreground"> · Bill:</span> {payment.billMonth}
              </>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Amount (₹)</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment Date</label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updatePayment.isPending}>
            {updatePayment.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
