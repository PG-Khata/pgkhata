"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { OnboardTenantModal } from "@/components/dashboard/onboard-tenant-modal"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function PublicSignupPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [propertyName, setPropertyName] = useState("")
  const [rooms, setRooms] = useState<Array<{ id: string; number: string; type: string }>>([])
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchProperty() {
      try {
        const res = await fetch(`${API_URL}/public/signup/${token}`)
        if (!res.ok) throw new Error("Invalid or expired link")
        const data = await res.json()
        setPropertyName(data.propertyName)
        setRooms(data.rooms ?? [])
      } catch (err) {
        setError("Invalid or expired signup link")
      } finally {
        setLoading(false)
      }
    }
    fetchProperty()
  }, [token])

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

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-lg font-semibold">Registration Submitted!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your details have been submitted to <strong>{propertyName}</strong>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            The property owner will review and approve your registration shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">{propertyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant Registration Form
          </p>
        </div>

        {/* Use OnboardTenantModal in page mode */}
        <OnboardTenantModal
          open={true}
          onOpenChange={() => {}}
          propertyId={token}
          isPublic={true}
          rooms={rooms}
          onPublicSubmit={() => {
            setSubmitted(true)
          }}
        />
      </div>
    </div>
  )
}
