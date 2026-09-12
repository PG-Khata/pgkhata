"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Upload, X, FileText, Plus } from "lucide-react"
import { useCreateTenant } from "@/hooks/use-tenants"
import { useCreateSecurityDeposit } from "@/hooks/use-security-deposits"
import { useCreateAdvancePayment } from "@/hooks/use-advance-payments"
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
  roomId: z.string().optional(),
  securityDeposit: z.string().optional().or(z.literal("")),
  advancePayment: z.string().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

interface OnboardTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  isPublic?: boolean
  onPublicSubmit?: () => void
  rooms?: Array<{ id: string; number: string; type: string }>
}

export function OnboardTenantModal({
  open,
  onOpenChange,
  propertyId,
  isPublic = false,
  onPublicSubmit,
  rooms = [],
}: OnboardTenantModalProps) {
  const createTenant = useCreateTenant(propertyId)
  const createSecurityDeposit = useCreateSecurityDeposit(propertyId)
  const createAdvancePayment = useCreateAdvancePayment(propertyId)
  const idProofInputRef = useRef<HTMLInputElement>(null)
  const [idProofFiles, setIdProofFiles] = useState<File[]>([])
  const [idProofError, setIdProofError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Remembers what already succeeded so a retry after a partial failure does not
  // create a second tenant (or duplicate its documents / billing rows).
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null)
  const [docsUploaded, setDocsUploaded] = useState(false)
  const [depositDone, setDepositDone] = useState(false)
  const [advanceDone, setAdvanceDone] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

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
    // Require ID proof in both modes
    if (idProofFiles.length === 0) {
      setIdProofError(true)
      return
    }

    if (isPublic && !data.roomId) {
      setError("roomId", { message: "Please select a room" })
      return
    }

    setSubmitting(true)
    try {
      if (isPublic) {
        // Public mode - use the public signup API
        const API_URL = "/api/backend"
        const res = await fetch(`${API_URL}/public/signup/${propertyId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            phone: data.phone,
            email: data.email,
            alternatePhone: data.alternatePhone,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            occupation: data.occupation,
            aadhaarNumber: data.aadhaarNumber,
            panNumber: data.panNumber || undefined,
            permanentAddress: data.permanentAddress,
            permanentAddressCity: data.permanentAddressCity,
            permanentAddressState: data.permanentAddressState,
            permanentAddressPincode: data.permanentAddressPincode,
            roomId: data.roomId,
            documents: await Promise.all(idProofFiles.map(async (file) => ({
              type: guessDocType(file.name),
              fileName: file.name,
              fileBase64: await fileToBase64(file),
              contentType: file.type || "application/octet-stream",
            }))),
          }),
        })

        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error || "Failed to submit")
        }

        toast.success("Registration submitted successfully!")
        if (onPublicSubmit) {
          onPublicSubmit()
        }
      } else {
        // Private mode - use the authenticated API. Each step is guarded so a
        // retry after a partial failure resumes rather than re-creating rows.
        let tenantId = createdTenantId
        if (!tenantId) {
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
          tenantId = tenant?.id ?? null
          setCreatedTenantId(tenantId)
        }

        if (tenantId) {
          // Upload all ID proof files
          if (!docsUploaded) {
            for (const file of idProofFiles) {
              const base64 = await fileToBase64(file)
              await api.post(
                `/v1/properties/${propertyId}/tenant-documents/tenant/${tenantId}`,
                {
                  type: guessDocType(file.name),
                  fileName: file.name,
                  fileBase64: base64,
                  contentType: file.type,
                },
              )
            }
            setDocsUploaded(true)
          }

          // Collect security deposit if provided
          if (!depositDone && data.securityDeposit && Number(data.securityDeposit) > 0) {
            await createSecurityDeposit.mutateAsync({
              tenantId,
              amount: Number(data.securityDeposit),
            })
          }
          setDepositDone(true)

          // Collect advance payment if provided
          if (!advanceDone && data.advancePayment && Number(data.advancePayment) > 0) {
            await createAdvancePayment.mutateAsync({
              tenantId,
              amount: Number(data.advancePayment),
            })
          }
          setAdvanceDone(true)
        }

        toast.success("Tenant onboarded")
        resetForm()
        onOpenChange(false)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to onboard tenant",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    reset()
    setIdProofFiles([])
    setIdProofError(false)
    setCreatedTenantId(null)
    setDocsUploaded(false)
    setDepositDone(false)
    setAdvanceDone(false)
    if (idProofInputRef.current) idProofInputRef.current.value = ""
  }

  const formBody = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Contact details */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  {(() => {
                    const pan = register("panNumber")
                    return (
                      <Input
                        {...pan}
                        onChange={(e) => {
                          // Uppercase before RHF reads the value so a lowercase
                          // entry still satisfies the PAN regex.
                          e.target.value = e.target.value.toUpperCase()
                          pan.onChange(e)
                        }}
                      />
                    )
                  })()}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          {isPublic && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Preferred room <span className="text-destructive">*</span>
              </label>
              <select
                {...register("roomId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.number} ({room.type})
                  </option>
                ))}
              </select>
              {errors.roomId && <p className="text-xs text-destructive">{errors.roomId.message}</p>}
            </div>
          )}

          {/* Billing - only show in private mode */}
          {!isPublic && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Billing
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          )}

          {isPublic ? (
            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Registration"}
              </Button>
            </div>
          ) : (
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
          )}
        </form>
  )

  // Public mode: render as a plain card so the whole page scrolls naturally on
  // mobile — no dimmed dialog overlay hiding the page header behind it.
  if (isPublic) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold sm:text-xl">Tenant Registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in your details below to register as a tenant.
          </p>
        </div>
        {formBody}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onboard tenant</DialogTitle>
          <DialogDescription>
            Capture the resident&apos;s details. You can assign a bed afterwards from Occupancy.
          </DialogDescription>
        </DialogHeader>
        {formBody}
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
