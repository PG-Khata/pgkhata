"use client";

import { useState } from "react";
import { useStartImpersonation } from "@/hooks/use-impersonation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { toast } from "sonner";

const MIN_REASON_LENGTH = 15;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
}

/**
 * Reason capture is the point of this dialog. A support session that nobody can
 * explain afterwards is exactly what the audit trail exists to prevent, so the
 * reason is required here rather than optional.
 */
export function StartImpersonationModal({ open, onOpenChange, ownerId, ownerName }: Props) {
  const start = useStartImpersonation();
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < MIN_REASON_LENGTH;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start.mutate(
      { ownerId, reason: reason.trim() },
      {
        // A full navigation, not a router.push: the handoff route runs on the
        // owner origin and must set a cookie there.
        onSuccess: (result) => window.location.assign(result.redirectUrl),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not start support session"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a support session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            You will enter <strong>{ownerName}</strong>&apos;s account in{" "}
            <strong>read-only</strong> mode. Nothing can be changed until you separately request
            write access and give a reason, which emails the owner.
          </div>
          <div>
            <label htmlFor="impersonate-reason" className="mb-1.5 block text-sm font-medium">
              Why do you need access?
            </label>
            <textarea
              id="impersonate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Owner called: says the November bill for room 12 shows the wrong amount."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              required
            />
            {reason.length > 0 && tooShort && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {MIN_REASON_LENGTH - reason.trim().length} more characters needed.
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Recorded against your name, and shown to the owner in their support access log.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={tooShort || start.isPending}>
              <Eye className="mr-1.5 h-4 w-4" />
              {start.isPending ? "Opening..." : "Continue to owner account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
