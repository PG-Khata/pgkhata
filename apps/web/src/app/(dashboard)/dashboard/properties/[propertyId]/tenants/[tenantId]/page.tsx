"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTenant, useUpdateTenant } from "@/hooks/use-tenants"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import {
  ArrowLeft, Bed, Clock, CreditCard, FileText, Pencil, ShieldOff, Users,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

export default function TenantProfilePage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.propertyId as string
  const tenantId = params.tenantId as string
  const { data: tenant, isLoading } = useTenant(propertyId, tenantId)
  const updateTenant = useUpdateTenant(propertyId, tenantId)
  const [editOpen, setEditOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", alternatePhone: "",
    gender: "", occupation: "", dateOfBirth: "",
    aadhaarNumber: "", panNumber: "",
    permanentAddress: "", permanentAddressCity: "",
    permanentAddressState: "", permanentAddressPincode: "",
  })

  function openEdit() {
    if (!tenant) return
    setEditForm({
      name: tenant.name || "", email: tenant.email || "", phone: tenant.phone || "",
      alternatePhone: tenant.alternatePhone || "", gender: tenant.gender || "",
      occupation: tenant.occupation || "",
      dateOfBirth: tenant.dateOfBirth ? tenant.dateOfBirth.split("T")[0] : "",
      aadhaarNumber: tenant.aadhaarNumber || "", panNumber: tenant.panNumber || "",
      permanentAddress: tenant.permanentAddress || "",
      permanentAddressCity: tenant.permanentAddressCity || "",
      permanentAddressState: tenant.permanentAddressState || "",
      permanentAddressPincode: tenant.permanentAddressPincode || "",
    })
    setEditOpen(true)
  }

  function handleEditSave() {
    const payload: Record<string, string> = {}
    for (const [key, val] of Object.entries(editForm)) {
      if (val) payload[key] = val
    }
    updateTenant.mutate(payload as any, {
      onSuccess: () => { toast.success("Tenant updated"); setEditOpen(false) },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update"),
    })
  }

  function handleDeactivate() {
    updateTenant.mutate({ status: "vacated" } as any, {
      onSuccess: () => { toast.success("Tenant deactivated"); setDeactivateOpen(false); router.push("/dashboard/tenants") },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to deactivate"),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48 md:col-span-2" /></div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tenants" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Tenants</Link>
        <div className="rounded-xl border border-dashed p-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-muted-foreground">Tenant not found</p></div>
      </div>
    )
  }

  const maskedAadhaar = tenant.aadhaarNumber ? "XXXX-XXXX-" + tenant.aadhaarNumber.slice(-4) : "----"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/tenants" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Tenants</Link>
          <h1 className="text-lg font-semibold tracking-tight">{tenant.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Onboarded {formatDateShort(tenant.joiningDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeactivateOpen(true)}><ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Deactivate</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{getInitials(tenant.name)}</div>
            <p className="mt-3 font-medium">{tenant.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground font-mono">{tenant.phone}</p>
            <div className="mt-2"><StatusBadge status={tenant.status} /></div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 md:col-span-2">
          <p className="mb-4 text-sm font-medium">Identity details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><p className="text-muted-foreground">Email</p><p className="mt-0.5">{tenant.email || "-"}</p></div>
            <div><p className="text-muted-foreground">Alternate phone</p><p className="mt-0.5">{tenant.alternatePhone || "-"}</p></div>
            <div><p className="text-muted-foreground">Gender</p><p className="mt-0.5 capitalize">{tenant.gender || "-"}</p></div>
            <div><p className="text-muted-foreground">Date of birth</p><p className="mt-0.5">{tenant.dateOfBirth ? formatDateShort(tenant.dateOfBirth) : "-"}</p></div>
            <div><p className="text-muted-foreground">Occupation</p><p className="mt-0.5">{tenant.occupation || "-"}</p></div>
            <div><p className="text-muted-foreground">Aadhaar</p><p className="mt-0.5 font-mono">{maskedAadhaar}</p></div>
            <div><p className="text-muted-foreground">PAN</p><p className="mt-0.5">{tenant.panNumber || "-"}</p></div>
            <div><p className="text-muted-foreground">City / State</p><p className="mt-0.5">{tenant.permanentAddressCity && tenant.permanentAddressState ? tenant.permanentAddressCity + ", " + tenant.permanentAddressState + (tenant.permanentAddressPincode ? " " + tenant.permanentAddressPincode : "") : "-"}</p></div>
            <div className="col-span-2"><p className="text-muted-foreground">Permanent address</p><p className="mt-0.5">{tenant.permanentAddress || "-"}</p></div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="occupancy">
        <TabsList variant="line">
          <TabsTrigger value="occupancy"><Bed className="mr-1.5 h-4 w-4" /> Occupancy</TabsTrigger>
          <TabsTrigger value="statement"><CreditCard className="mr-1.5 h-4 w-4" /> Statement</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-1.5 h-4 w-4" /> Documents</TabsTrigger>
          <TabsTrigger value="emergency"><Users className="mr-1.5 h-4 w-4" /> Emergency Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="occupancy" className="mt-4">
          {tenant.bedId ? (
            <div className="rounded-xl border bg-card p-6"><p className="text-sm font-medium">Current stay</p><p className="mt-1 text-sm text-muted-foreground">Room {tenant.roomNumber} Bed {tenant.bedNumber}</p></div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center"><Bed className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-muted-foreground">No active stay</p></div>
          )}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">Allocation history</p></div>
            <div className="rounded-xl border border-dashed p-10 text-center"><Bed className="mx-auto h-8 w-8 text-muted-foreground/30" /><p className="mt-2 text-sm text-muted-foreground">No past allocations</p></div>
          </div>
        </TabsContent>
        <TabsContent value="statement" className="mt-4">
          <div className="rounded-xl border border-dashed p-12 text-center"><CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-muted-foreground">No billing data</p></div>
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="rounded-xl border border-dashed p-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-muted-foreground">No documents</p></div>
        </TabsContent>
        <TabsContent value="emergency" className="mt-4">
          <div className="rounded-xl border border-dashed p-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium text-muted-foreground">No emergency contacts</p></div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit tenant</DialogTitle><DialogDescription>Update {tenant.name}'s details.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">Full name</label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Phone</label><Input value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">Alternate phone</label><Input value={editForm.alternatePhone} onChange={(e) => setEditForm({...editForm, alternatePhone: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Email</label><Input value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">Date of birth</label><Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({...editForm, dateOfBirth: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Gender</label><select value={editForm.gender} onChange={(e) => setEditForm({...editForm, gender: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Occupation</label><Input value={editForm.occupation} onChange={(e) => setEditForm({...editForm, occupation: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">Aadhaar</label><Input value={editForm.aadhaarNumber} onChange={(e) => setEditForm({...editForm, aadhaarNumber: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">PAN</label><Input value={editForm.panNumber} onChange={(e) => setEditForm({...editForm, panNumber: e.target.value})} /></div>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Permanent address</label><Input value={editForm.permanentAddress} onChange={(e) => setEditForm({...editForm, permanentAddress: e.target.value})} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">City</label><Input value={editForm.permanentAddressCity} onChange={(e) => setEditForm({...editForm, permanentAddressCity: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">State</label><Input value={editForm.permanentAddressState} onChange={(e) => setEditForm({...editForm, permanentAddressState: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Pincode</label><Input value={editForm.permanentAddressPincode} onChange={(e) => setEditForm({...editForm, permanentAddressPincode: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEditSave} disabled={updateTenant.isPending}>{updateTenant.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Deactivate tenant</DialogTitle><DialogDescription>This will mark {tenant.name} as vacated and release their bed.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleDeactivate} disabled={updateTenant.isPending}>{updateTenant.isPending ? "Deactivating..." : "Deactivate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
