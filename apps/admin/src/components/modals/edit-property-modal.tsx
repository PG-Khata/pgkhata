"use client";

import { useState } from "react";
import { useUpdateAdminProperty } from "@/hooks/use-admin-properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AdminProperty } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: AdminProperty;
}

export function EditPropertyModal({ open, onOpenChange, property }: Props) {
  const updateProperty = useUpdateAdminProperty(property.id);
  const [name, setName] = useState(property.name);
  const [address, setAddress] = useState(property.address ?? "");
  const [city, setCity] = useState(property.city ?? "");
  const [state, setState] = useState(property.state ?? "");
  const [pincode, setPincode] = useState(property.pincode ?? "");
  const [electricityMode, setElectricityMode] = useState(property.electricityMode);
  const [electricityRatePerUnit, setElectricityRatePerUnit] = useState(
    property.electricityRatePerUnit?.toString() ?? "",
  );
  const [upiVpa, setUpiVpa] = useState(property.upiVpa ?? "");

  function handleSave() {
    updateProperty.mutate(
      {
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        electricityMode,
        electricityRatePerUnit: electricityRatePerUnit ? parseInt(electricityRatePerUnit) : null,
        upiVpa: upiVpa || null,
      },
      {
        onSuccess: () => {
          toast.success("Property updated");
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
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Pincode</label>
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Electricity Mode</label>
              <select
                value={electricityMode}
                onChange={(e) => setElectricityMode(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="flat">Flat Rate</option>
                <option value="meter">Per Unit</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Rate/Unit (₹)</label>
              <Input
                type="number"
                value={electricityRatePerUnit}
                onChange={(e) => setElectricityRatePerUnit(e.target.value)}
                placeholder="8"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">UPI VPA</label>
              <Input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="name@upi" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateProperty.isPending}>
            {updateProperty.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
