"use client"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Share2, Loader2, Download } from "lucide-react"
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

interface ComplaintQrModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyName: string
  complaintToken?: string
  propertyId: string
}

export function ComplaintQrModal({
  open,
  onOpenChange,
  propertyName,
  complaintToken: initialToken,
  propertyId,
}: ComplaintQrModalProps) {
  const [copied, setCopied] = useState(false)
  const [complaintToken, setComplaintToken] = useState(initialToken || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && !complaintToken) {
      fetchComplaintToken()
    }
  }, [open, complaintToken])

  async function fetchComplaintToken() {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<{ token: string }>(`/v1/properties/${propertyId}/complaint-qr`)
      setComplaintToken(data.token)
    } catch (err) {
      setError("Failed to generate complaint link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const complaintUrl = complaintToken ? `${window.location.origin}/public/complaint/${complaintToken}` : ""

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(complaintUrl)
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
          title: `Complaint - ${propertyName}`,
          text: `Submit a complaint at ${propertyName}`,
          url: complaintUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  function handleDownloadQR() {
    const svg = document.getElementById("complaint-qr-code")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `${propertyName}-complaint-qr.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
        <DialogHeader className="text-center pb-4">
          <DialogTitle className="text-xl">Complaint QR Code</DialogTitle>
          <DialogDescription className="text-sm">
            Share this QR code with tenants to submit complaints.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Generating complaint link...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchComplaintToken}>
              Try Again
            </Button>
          </div>
        ) : complaintUrl ? (
          <div className="flex flex-col items-center gap-5">
            {/* QR Code */}
            <div className="rounded-xl border-2 border-muted-foreground/10 bg-white p-4 shadow-sm">
              <QRCodeSVG
                id="complaint-qr-code"
                value={complaintUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Property name */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Complaint form for</p>
              <p className="text-lg font-semibold mt-0.5">{propertyName}</p>
            </div>

            {/* Link with copy button */}
            <div className="w-full space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                Complaint Link
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={complaintUrl}
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

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <Button onClick={handleShare} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                <Share2 className="mr-2 h-5 w-5" />
                Share
              </Button>
              <Button onClick={handleDownloadQR} variant="outline" className="flex-1" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Download QR
              </Button>
            </div>

            {/* Info */}
            <div className="w-full rounded-lg border bg-muted/20 p-4">
              <p className="font-medium text-sm mb-2">How it works:</p>
              <ol className="space-y-2">
                {[
                  "Print this QR code and place it in your PG",
                  "Tenants scan QR to open complaint form",
                  "Tenants fill subject and description",
                  "You see complaints in your dashboard"
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
