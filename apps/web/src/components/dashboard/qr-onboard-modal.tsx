"use client"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Share2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface QrOnboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyName: string
  signupToken?: string
  propertyId: string
}

export function QrOnboardModal({
  open,
  onOpenChange,
  propertyName,
  signupToken: initialToken,
  propertyId,
}: QrOnboardModalProps) {
  const [copied, setCopied] = useState(false)
  const [signupToken, setSignupToken] = useState(initialToken || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && !signupToken) {
      fetchSignupToken()
    }
  }, [open, signupToken])

  async function fetchSignupToken() {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<{ token: string }>(`/v1/properties/${propertyId}/qr-code`)
      setSignupToken(data.token)
    } catch (err) {
      setError("Failed to generate signup link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const signupUrl = signupToken ? `${window.location.origin}/public/signup/${signupToken}` : ""

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(signupUrl)
      setCopied(true)
      toast.success("Link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${propertyName}`,
          text: `Fill this form to register as a tenant at ${propertyName}`,
          url: signupUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
        <DialogHeader className="text-center pb-4">
          <DialogTitle className="text-xl">Add Tenant via QR</DialogTitle>
          <DialogDescription className="text-sm">
            Share this QR code or link with your tenant to fill the form directly.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Generating signup link...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSignupToken}>
              Try Again
            </Button>
          </div>
        ) : signupUrl ? (
          <div className="flex flex-col items-center gap-5">
            {/* QR Code */}
            <div className="rounded-xl border-2 border-muted-foreground/10 bg-white p-4 shadow-sm">
              <QRCodeSVG
                value={signupUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Property name */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Tenant signup for</p>
              <p className="text-lg font-semibold mt-0.5">{propertyName}</p>
            </div>

            {/* Link with copy button */}
            <div className="w-full space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                Signup Link
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={signupUrl}
                    readOnly
                    className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 pr-10 text-xs text-muted-foreground truncate cursor-default"
                  />
                  <button
                    onClick={handleCopy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Share button */}
            <Button onClick={handleShare} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
              <Share2 className="mr-2 h-5 w-5" />
              Share with Tenant
            </Button>

            {/* Instructions */}
            <div className="w-full rounded-lg border bg-muted/20 p-4">
              <p className="font-medium text-sm mb-3">How it works:</p>
              <ol className="space-y-2.5">
                {[
                  "Share QR code or link with your tenant",
                  "Tenant opens link and fills the form",
                  "Tenant appears as \"Pending\" in your list",
                  "You approve and assign a bed"
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
