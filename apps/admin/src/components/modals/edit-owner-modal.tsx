"use client";

import { useState } from "react";
import { useUpdateAdminOwner } from "@/hooks/use-admin-owners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  currentPhone: string | null;
}

export function EditOwnerModal({ open, onOpenChange, ownerId, currentPhone }: Props) {
  const updateOwner = useUpdateAdminOwner(ownerId);
  // Seeded once per mount; the parent remounts this modal (via `key`) when
  // `currentPhone` changes so the field never shows a stale value.
  const [phone, setPhone] = useState(currentPhone ?? "");

  function handleSave() {
    updateOwner.mutate(
      { phone },
      {
        onSuccess: () => {
          toast.success("Owner updated");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Owner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateOwner.isPending}>
            {updateOwner.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
