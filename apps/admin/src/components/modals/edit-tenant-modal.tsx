"use client";

import { useState } from "react";
import { useUpdateAdminTenant } from "@/hooks/use-admin-tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AdminTenant } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: AdminTenant;
}

export function EditTenantModal({ open, onOpenChange, tenant }: Props) {
  const updateTenant = useUpdateAdminTenant(tenant.id);
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone);
  const [email, setEmail] = useState(tenant.email ?? "");
  const [occupation, setOccupation] = useState(tenant.occupation ?? "");
  const [notes, setNotes] = useState(tenant.notes ?? "");

  function handleSave() {
    updateTenant.mutate(
      {
        name,
        phone,
        email: email || null,
        occupation: occupation || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Tenant updated");
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
          <DialogTitle>Edit Tenant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Occupation</label>
              <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateTenant.isPending}>
            {updateTenant.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
