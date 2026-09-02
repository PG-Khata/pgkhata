"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Camera, Upload, X, FileText, Plus } from "lucide-react"
import { useCreateTenant } from "@/hooks/use-tenants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  email: z.string().min(1, "Email is required").email("Invalid email"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  occupation: z.string().min(1, "Occupation is required").max(100),
  aadhaarNumber: z
    .string()
    .min(1, "Aadhaar number is required")
    .regex(/^\d{12}$/, "Must be 12 digits"),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
  permanentAddress: z.string().min(1, "Permanent address is required"),
  permanentAddressCity: z.string().min(1, "City is required"),
  permanentAddressState: z.string().min(1, "State is required"),
  permanentAddressPincode: z.string().min(1, "Pincode is required").regex(/^\d{6}$/, "Must be 6 digits"),
  securityDeposit: z.string().optional().or(z.literal("")),
  advancePayment: z.string().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

interface OnboardTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function OnboardTenantModal({
  open,
  onOpenChange,
  propertyId,
}: OnboardTenantModalProps) {
  const createTenant = useCreateTenant(propertyId)
  const profileInputRef = useRef<HTMLInputElement>(null)
  const idProofInputRef = useRef<HTMLInputElement>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [idProofFiles, setIdProofFiles] = useState<File[]>([])
  const [idProofError, setIdProofError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  function handleProfileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setProfilePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleIdProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setIdProofFiles((prev) => [...prev, ...Array.from(files)])
    setIdProofError(false)
    if (idProofInputRef.current) idProofInputRef.current.value = ""
  }

  function removeIdProof(index: number) {
    setIdProofFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(data: FormData) {
    if (idProofFiles.length === 0) {
      setIdProofError(true)
      return
    }

    setSubmitting(true)
    try {
      const tenant = await createTenant.mutateAsync({
        name: data.name,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender as "male" | "female" | "other",
        occupation: data.occupation,
        aadhaarNumber: data.aadhaarNumber,
        panNumber: data.panNumber || undefined,
        permanentAddress: data.permanentAddress,
        permanentAddressCity: data.permanentAddressCity,
        permanentAddressState: data.permanentAddressState,
        permanentAddressPincode: data.permanentAddressPincode,
        joiningDate: new Date().toISOString(),
      })

      // Upload all ID proof files
      if (tenant?.id) {
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

        // Collect security deposit if provided
        if (data.securityDeposit && Number(data.securityDeposit) > 0) {
          await api.post(`/v1/properties/${propertyId}/security-deposits`, {
            tenantId: tenant.id,
            amount: Number(data.securityDeposit),
          })
        }

        // Collect advance payment if provided
        if (data.advancePayment && Number(data.advancePayment) > 0) {
          await api.post(`/v1/properties/${propertyId}/advance-payments`, {
            tenantId: tenant.id,
            amount: Number(data.advancePayment),
          })
        }
      }

      toast.success("Tenant onboarded")
      resetForm()
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to onboard tenant",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    reset()
    setProfilePreview(null)
    setProfileFile(null)
    setIdProofFiles([])
    setIdProofError(false)
    if (profileInputRef.current) profileInputRef.current.value = ""
    if (idProofInputRef.current) idProofInputRef.current.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onboard tenant</DialogTitle>
          <DialogDescription>
            Capture the resident's details. You can assign a bed afterwards from
            Occupancy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile image */}
          <div className="flex justify-center">
            <div className="relative">
              <div
                className="h-20 w-20 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex items-center justify-center"
                onClick={() => profileInputRef.current?.click()}
              >
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm"
                onClick={() => profileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileChange}
              />
            </div>
          </div>

          {/* Contact details */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Full name (as per Aadhaar) <span className="text-destructive">*</span>
                  </label>
                  <Input {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Mobile number <span className="text-destructive">*</span></label>
                  <div className="flex">
                    <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                    <Input {...register("phone")} maxLength={10} className="rounded-l-none" placeholder="9876543210" />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Alternate phone</label>
                  <div className="flex">
                    <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                    <Input {...register("alternatePhone")} maxLength={10} className="rounded-l-none" placeholder="9876543210" />
                  </div>
                  {errors.alternatePhone && errors.alternatePhone.message && (
                    <p className="text-xs text-destructive">
                      {errors.alternatePhone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                  <Input type="email" {...register("email")} />
                  {errors.email && (
                    <p className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal details */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Personal details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date of birth <span className="text-destructive">*</span></label>
                  <Input type="date" {...register("dateOfBirth")} />
                  {errors.dateOfBirth && (
                    <p className="text-xs text-destructive">
                      {errors.dateOfBirth.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Gender <span className="text-destructive">*</span></label>
                  <select
                    {...register("gender")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="text-xs text-destructive">
                      {errors.gender.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Occupation <span className="text-destructive">*</span></label>
                <Input
                  placeholder="Job / Student / Business"
                  {...register("occupation")}
                />
                {errors.occupation && (
                  <p className="text-xs text-destructive">
                    {errors.occupation.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Identity & address */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Identity & address
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Aadhaar number <span className="text-destructive">*</span></label>
                  <Input {...register("aadhaarNumber")} maxLength={12} placeholder="123456789012" />
                  {errors.aadhaarNumber && (
                    <p className="text-xs text-destructive">
                      {errors.aadhaarNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">PAN (optional)</label>
                  <Input {...register("panNumber")} />
                  {errors.panNumber && errors.panNumber.message && (
                    <p className="text-xs text-destructive">
                      {errors.panNumber.message}
                    </p>
                  )}
                </div>
              </div>

              {/* ID proof uploads — multiple files */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ID proof <span className="text-destructive">*</span></label>
                <div className="space-y-2">
                  {idProofFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeIdProof(index)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => idProofInputRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  >
                    {idProofFiles.length > 0 ? (
                      <>
                        <Plus className="h-4 w-4" />
                        Add more files
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Attach Aadhaar / ID proof
                      </>
                    )}
                  </button>
                  {idProofError && (
                    <p className="text-xs text-destructive">
                      At least one ID proof document is required
                    </p>
                  )}
                </div>
                <input
                  ref={idProofInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleIdProofChange}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Permanent address <span className="text-destructive">*</span>
                </label>
                <Textarea rows={2} {...register("permanentAddress")} />
                {errors.permanentAddress && (
                  <p className="text-xs text-destructive">
                    {errors.permanentAddress.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">City <span className="text-destructive">*</span></label>
                  <Input {...register("permanentAddressCity")} />
                  {errors.permanentAddressCity && (
                    <p className="text-xs text-destructive">
                      {errors.permanentAddressCity.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">State <span className="text-destructive">*</span></label>
                  <select
                    {...register("permanentAddressState")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.permanentAddressState && (
                    <p className="text-xs text-destructive">
                      {errors.permanentAddressState.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Pincode <span className="text-destructive">*</span></label>
                  <Input {...register("permanentAddressPincode")} maxLength={6} placeholder="201301" />
                  {errors.permanentAddressPincode && (
                    <p className="text-xs text-destructive">
                      {errors.permanentAddressPincode.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Billing */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Billing
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Security deposit</label>
                <Input type="number" placeholder="0" {...register("securityDeposit")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Advance payment</label>
                <Input type="number" placeholder="0" {...register("advancePayment")} />
              </div>
            </div>
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
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Onboarding..." : "Onboard tenant"}
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
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function guessDocType(
  fileName: string,
): "aadhaar" | "pan" | "passport" | "driving_license" | "other" {
  const lower = fileName.toLowerCase()
  if (lower.includes("aadhaar") || lower.includes("aadhar")) return "aadhaar"
  if (lower.includes("pan")) return "pan"
  if (lower.includes("passport")) return "passport"
  if (lower.includes("dl") || lower.includes("driving")) return "driving_license"
  return "other"
}
