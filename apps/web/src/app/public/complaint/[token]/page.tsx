"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

const schema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(1000),
  roomNumber: z.string().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

export default function PublicComplaintPage() {
  const params = useParams()
  const token = params.token as string
  const [propertyName, setPropertyName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch(`${API_URL}/public/complaint/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired link")
        return res.json()
      })
      .then((data) => setPropertyName(data.propertyName))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function onSubmit(formData: FormData) {
    try {
      const res = await fetch(`${API_URL}/public/complaint/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          roomNumber: formData.roomNumber || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Submission failed")
      }
      setSuccess(true)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="text-lg font-semibold">Complaint submitted</h1>
          <p className="text-sm text-muted-foreground">
            Your complaint has been received. The property owner will review it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{propertyName}</h1>
          <p className="text-sm text-muted-foreground">Submit a complaint</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Room number</label>
            <Input placeholder="e.g. 101" {...register("roomNumber")} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject *</label>
            <Input placeholder="Brief description" {...register("subject")} />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description *</label>
            <textarea
              {...register("description")}
              placeholder="Describe the issue in detail"
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Submit complaint
          </Button>
        </form>
      </div>
    </div>
  )
}
