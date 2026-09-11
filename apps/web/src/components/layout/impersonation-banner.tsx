"use client"

import { useEffect, useState } from "react"
import {
  useImpersonationStatus,
  useEscalateImpersonation,
  useExtendImpersonation,
  useExitImpersonation,
} from "@/hooks/use-impersonation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Eye, LogOut, Pencil, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

const MIN_REASON_LENGTH = 15

function useCountdown(iso: string | undefined): string {
  const [label, setLabel] = useState("")

  useEffect(() => {
    if (!iso) return
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now()
      if (ms <= 0) return setLabel("expired")
      const mins = Math.floor(ms / 60_000)
      const secs = Math.floor((ms % 60_000) / 1000)
      setLabel(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [iso])

  return label
}

function EscalateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const escalate = useEscalateImpersonation()
  const [reason, setReason] = useState("")
  const tooShort = reason.trim().length < MIN_REASON_LENGTH

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    escalate.mutate(reason.trim(), {
      onSuccess: () => {
        toast.success("Write access granted for 15 minutes")
        setReason("")
        onOpenChange(false)
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not request write access"),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request write access</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This opens a 15-minute window in which you can change this owner&apos;s data. The owner
            is emailed your reason, and every change is recorded against your name.
          </p>
          <div>
            <label htmlFor="escalate-reason" className="mb-1.5 block text-sm font-medium">
              What are you about to change, and why?
            </label>
            <Textarea
              id="escalate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Owner reported bill #—— has the wrong electricity units; correcting the reading they gave over the phone."
              required
            />
            {tooShort && reason.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {MIN_REASON_LENGTH - reason.trim().length} more characters needed.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={tooShort || escalate.isPending}>
              {escalate.isPending ? "Requesting..." : "Grant write access"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Rendered unconditionally in the dashboard layout; returns null for a genuine
 * owner. The support agent must never be able to forget which account they are
 * in, so this is sticky and sits above the header rather than inside it.
 */
export function ImpersonationBanner() {
  const { data } = useImpersonationStatus()
  const extend = useExtendImpersonation()
  const exit = useExitImpersonation()
  const [escalateOpen, setEscalateOpen] = useState(false)

  const writeCountdown = useCountdown(data?.writeExpiresAt ?? undefined)
  const sessionCountdown = useCountdown(data?.expiresAt)

  if (!data?.active) return null

  const canWrite = data.canWrite === true

  function handleExit() {
    exit.mutate(undefined, {
      onSuccess: (result) => {
        window.location.assign(result.returnUrl)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Could not exit"),
    })
  }

  return (
    <>
      <div
        role="status"
        className={`sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm ${
          canWrite ? "bg-red-600 text-white" : "bg-amber-500 text-amber-950"
        }`}
      >
        {canWrite ? (
          <ShieldAlert className="h-4 w-4 shrink-0" />
        ) : (
          <Eye className="h-4 w-4 shrink-0" />
        )}

        <span className="min-w-0">
          {canWrite ? (
            <>
              <strong>Write access</strong> to {data.ownerName}&apos;s account &mdash; ends in{" "}
              {writeCountdown}
            </>
          ) : (
            <>
              Viewing <strong>{data.ownerName}</strong>&apos;s account as {data.adminName}{" "}
              &mdash; read-only
            </>
          )}
        </span>

        <span className="ml-auto flex items-center gap-2">
          <span className="hidden opacity-80 sm:inline">Session ends in {sessionCountdown}</span>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => extend.mutate(undefined, {
              onSuccess: () => toast.success("Session extended"),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Could not extend"),
            })}
            disabled={extend.isPending}
          >
            Extend
          </Button>

          {!canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setEscalateOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Request write access
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={handleExit} disabled={exit.isPending}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {exit.isPending ? "Exiting..." : "Exit"}
          </Button>
        </span>
      </div>

      <EscalateDialog open={escalateOpen} onOpenChange={setEscalateOpen} />
    </>
  )
}
