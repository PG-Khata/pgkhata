"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

function VerifyEmailForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get("email")?.trim() ?? ""
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!email || !/^\d{6}$/.test(otp)) {
      toast.error("Enter the 6-digit code from your email")
      return
    }
    setLoading(true)
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp })
      if (result.error) toast.error(result.error.message || "Invalid or expired code")
      else {
        toast.success("Email verified")
        router.replace("/dashboard")
      }
    } catch {
      toast.error("Verification service is temporarily unavailable")
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (!email) return
    setResending(true)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })
      if (result.error) toast.error(result.error.message || "Could not resend code")
      else toast.success("A new verification code was sent")
    } catch {
      toast.error("Email service is temporarily unavailable. Please try again.")
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return <p className="text-sm">Missing email address. <Link className="underline" href="/register">Register again</Link>.</p>
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter the code sent to {email}.</p>
      <form onSubmit={verify} className="mt-6 space-y-4">
        <Input
          aria-label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          placeholder="123456"
        />
        <Button className="w-full" type="submit" disabled={loading || otp.length !== 6}>
          {loading ? "Verifying..." : "Verify email"}
        </Button>
      </form>
      <Button className="mt-3 w-full" type="button" variant="ghost" disabled={resending} onClick={resend}>
        {resending ? "Sending..." : "Resend code"}
      </Button>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<p className="text-sm">Loading verification…</p>}><VerifyEmailForm /></Suspense>
}
