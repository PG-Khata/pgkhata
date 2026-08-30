"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2 } from "lucide-react"
import { formatDateShort } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface OnboardingStatus {
  name: string
  status: string
  roomNumber: string | null
  joiningDate: string
}

export default function OnboardingStatusPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`${API_URL}/public/onboarding/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired link")
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-destructive">{error || "Invalid link"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="text-lg font-semibold">Welcome, {data.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.roomNumber
            ? `You've been placed in room ${data.roomNumber}.`
            : "Your application has been approved."}
        </p>
        <p className="text-xs text-muted-foreground">
          Joined {formatDateShort(data.joiningDate)}
        </p>
      </div>
    </div>
  )
}
