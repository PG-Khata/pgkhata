"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { CheckCircle2, Loader2, MessageSquare } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface Tenant {
  id: string
  name: string
}

interface Room {
  id: string
  number: string
  tenants: Tenant[]
}

const schema = z.object({
  roomId: z.string().min(1, "Please select a room"),
  tenantId: z.string().optional(),
  category: z.enum(["plumbing", "electrical", "cleaning", "maintenance", "security", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(1000),
})

type FormData = z.infer<typeof schema>

const CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
]

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
]

export default function PublicComplaintPage() {
  const params = useParams()
  const token = params.token as string
  const [propertyName, setPropertyName] = useState("")
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "medium",
      category: "maintenance",
    },
  })

  const watchRoomId = watch("roomId")

  useEffect(() => {
    fetch(`${API_URL}/public/complaint/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired link")
        return res.json()
      })
      .then((data) => {
        setPropertyName(data.propertyName)
        setRooms(data.rooms || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  // Update selected tenant when room changes
  useEffect(() => {
    if (watchRoomId) {
      const room = rooms.find(r => r.id === watchRoomId)
      if (room && room.tenants.length > 0) {
        // Auto-select first tenant if only one
        if (room.tenants.length === 1) {
          setValue("tenantId", room.tenants[0].id)
        } else {
          setValue("tenantId", "")
        }
      } else {
        setValue("tenantId", "")
      }
    }
  }, [watchRoomId, rooms, setValue])

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/public/complaint/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: formData.roomId,
          tenantId: formData.tenantId || undefined,
          category: formData.category,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Submission failed")
      }
      setSuccess(true)
      toast.success("Complaint submitted successfully!")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold">Invalid Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-lg font-semibold">Complaint Submitted!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your complaint at <strong>{propertyName}</strong> has been submitted.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            The property owner will review and address your complaint shortly.
          </p>
        </div>
      </div>
    )
  }

  const selectedRoom = rooms.find(r => r.id === watchRoomId)

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <MessageSquare className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">{propertyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a Complaint
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          {/* Room Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Room Number <span className="text-destructive">*</span>
            </label>
            <select
              {...register("roomId")}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">Select your room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.number}
                  {room.tenants.length > 0 && ` (${room.tenants.map(t => t.name).join(", ")})`}
                </option>
              ))}
            </select>
            {errors.roomId && <p className="text-xs text-destructive">{errors.roomId.message}</p>}
          </div>

          {/* Tenant Selection (if multiple tenants in room) */}
          {selectedRoom && selectedRoom.tenants.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Your Name <span className="text-destructive">*</span>
              </label>
              <select
                {...register("tenantId")}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Select your name</option>
                {selectedRoom.tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          )}


          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                {...register("category")}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Priority <span className="text-destructive">*</span>
              </label>
              <select
                {...register("priority")}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject <span className="text-destructive">*</span>
            </label>
            <Input placeholder="Brief summary of your complaint" {...register("subject")} />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </label>
            <Textarea
              {...register("description")}
              placeholder="Describe the issue in detail..."
              rows={4}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Complaint"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Your complaint will be reviewed by the property owner.
          </p>
        </form>
      </div>
    </div>
  )
}
