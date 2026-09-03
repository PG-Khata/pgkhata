"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Camera, Upload, X, FileText, Plus, Trash2 } from "lucide-react"
import { useUpdateTenant } from "@/hooks/use-tenants"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Tenant } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, api } from "@/lib/api-client"

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

const schema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  phone: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^\d{10}$/, "Must be 10 digits"),
  alternatePhone: z
    .string()
    .regex(/^\d{10}$/, "Must be 10 digits")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  occupation: z.string().max(100).optional().or(z.literal("")),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, "Must be 12 digits")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
  permanentAddress: z.string().optional().or(z.literal("")),
  permanentAddressCity: z.string().optional().or(z.literal("")),
  permanentAddressState: z.string().optional().or(z.literal("")),
  permanentAddressPincode: z.string().regex(/^\d{6}$/, "Must be 6 digits").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

interface TenantDocument {
  id: string
  tenantId: string
  type: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  uploadedAt: string
}

interface EditTenantModalProps {
  tenant: Tenant | null
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function EditTenantModal({
  tenant,
  open,
  onOpenChange,
  propertyId,
}: EditTenantModalProps) {
  const qc = useQueryClient()
  const updateTenant = useUpdateTenant(propertyId, tenant?.id ?? "")
  const idProofInputRef = useRef<HTMLInputElement>(null)
  const [idProofFiles, setIdProofFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const { data: documents, isLoading: docsLoading } = useQuery<TenantDocument[]>({
    queryKey: ["tenant-documents", propertyId, tenant?.id],
    queryFn: () => api.get(`/v1/properties/${propertyId}/tenant-documents/tenant/${tenant?.id}`),
    enabled: open && !!tenant?.id,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    if (!tenant) return
    reset({
      name: tenant.name,
      phone: tenant.phone,
      alternatePhone: tenant.alternatePhone ?? "",
      email: tenant.email ?? "",
      dateOfBirth: tenant.dateOfBirth ? tenant.dateOfBirth.split("T")[0] : "",
      gender: tenant.gender ?? "",
      occupation: tenant.occupation ?? "",
      aadhaarNumber: tenant.aadhaarNumber ?? "",
      panNumber: tenant.panNumber ?? "",
      permanentAddress: tenant.permanentAddress ?? "",
      permanentAddressCity: tenant.permanentAddressCity ?? "",
      permanentAddressState: tenant.permanentAddressState ?? "",
      permanentAddressPincode: tenant.permanentAddressPincode ?? "",
      notes: tenant.notes ?? "",
    })
  }, [tenant, reset])

  function handleIdProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setIdProofFiles((prev) => [...prev, ...Array.from(files)])
    if (idProofInputRef.current) idProofInputRef.current.value = ""
  }

  function removeIdProof(index: number) {
    setIdProofFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleDeleteDocument(docId: string) {
    if (!confirm("Delete this document?")) return
    try {
      await api.delete(`/v1/properties/${propertyId}/tenant-documents/${docId}`)
      toast.success("Document deleted")
      qc.invalidateQueries({ queryKey: ["tenant-documents", propertyId, tenant?.id] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete document")
    }
  }

  async function onSubmit(data: FormData) {
    if (!tenant) return

    setUploading(true)
    try {
      // Update tenant details
      await updateTenant.mutateAsync({
        name: data.name,
        phone: data.phone,
        alternatePhone: data.alternatePhone || undefined,
        email: data.email || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender as "male" | "female" | "other" | undefined,
        occupation: data.occupation || undefined,
        aadhaarNumber: data.aadhaarNumber || undefined,
        panNumber: data.panNumber || undefined,
        permanentAddress: data.permanentAddress || undefined,
        permanentAddressCity: data.permanentAddressCity || undefined,
        permanentAddressState: data.permanentAddressState || undefined,
        permanentAddressPincode: data.permanentAddressPincode || undefined,
        notes: data.notes || undefined,
      })

      // Upload new ID proof files
      for (const file of idProofFiles) {
        const base64 = await fileToBase64(file)
        await api.post(
          `/v1/properties/${propertyId}/tenant-documents/tenant/${tenant.id}`,
          {
            type: guessDocType(file.name),
            fileName: file.name,
            fileBase64: base64,
            contentType: file.type,
          },
        )
      }

      toast.success("Tenant updated")
      setIdProofFiles([])
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["tenant-documents", propertyId, tenant.id] })
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to update tenant",
      )
    } finally {
      setUploading(false)
    }
  }

  function resetForm() {
    reset()
    setIdProofFiles([])
  }

  const newFiles = idProofFiles.map((file, i) => ({
    id: `new-${i}`,
    tenantId: tenant?.id ?? "",
    type: guessDocType(file.name),
    fileName: file.name,
    fileUrl: "",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    isNew: true as const,
    index: i,
  }))

  const allDocuments = [
    ...(documents ?? []),
    ...newFiles,
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription>Update tenant details and manage documents.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Personal Information */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Personal Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Full name <span className="text-destructive">*</span></label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mobile <span className="text-destructive">*</span></label>
                <div className="flex">
                  <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input {...register("phone")} className="rounded-l-none" maxLength={10} />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Alternate phone</label>
                <div className="flex">
                  <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input {...register("alternatePhone")} className="rounded-l-none" maxLength={10} />
                </div>
                {errors.alternatePhone && <p className="text-xs text-destructive">{errors.alternatePhone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date of birth</label>
                <Input type="date" {...register("dateOfBirth")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Gender</label>
                <select
                  {...register("gender")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Occupation</label>
                <Input {...register("occupation")} />
              </div>
            </div>
          </div>

          {/* KYC */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              KYC
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Aadhaar number</label>
                <Input {...register("aadhaarNumber")} maxLength={12} />
                {errors.aadhaarNumber && <p className="text-xs text-destructive">{errors.aadhaarNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">PAN number</label>
                <Input {...register("panNumber")} maxLength={10} />
                {errors.panNumber && <p className="text-xs text-destructive">{errors.panNumber.message}</p>}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Permanent Address
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Address</label>
              <Textarea rows={2} {...register("permanentAddress")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <Input {...register("permanentAddressCity")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">State</label>
                <select
                  {...register("permanentAddressState")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pincode</label>
                <Input {...register("permanentAddressPincode")} maxLength={6} />
                {errors.permanentAddressPincode && <p className="text-xs text-destructive">{errors.permanentAddressPincode.message}</p>}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documents
            </p>

            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : allDocuments.length > 0 ? (
              <div className="space-y-2">
                {allDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type.replace("_", " ").toUpperCase()}
                          {doc.fileSize && ` • ${formatFileSize(doc.fileSize)}`}
                        </p>
                      </div>
                    </div>
                    {"isNew" in doc && (doc as any).isNew ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeIdProof((doc as any).index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            )}

            <div>
              <input
                type="file"
                ref={idProofInputRef}
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={handleIdProofChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => idProofInputRef.current?.click()}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add documents
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Aadhaar, PAN, passport, or other ID proofs. JPG, PNG, or PDF.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea rows={2} {...register("notes")} placeholder="Optional notes about this tenant" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={uploading}>
              {uploading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1]
      resolve(base64 || "")
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function guessDocType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes("aadhaar") || lower.includes("aadhar")) return "aadhaar"
  if (lower.includes("pan")) return "pan"
  if (lower.includes("passport")) return "passport"
  if (lower.includes("license") || lower.includes("licence")) return "driving_license"
  return "other"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
