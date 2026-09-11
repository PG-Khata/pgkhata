"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  SUSPEND_REASON_MIN_LENGTH,
  useReactivateOwner,
  useSuspendOwner,
} from "@/hooks/use-owner-overview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
  /** Suspending locks the owner out; reactivating gives the account back. */
  action: "suspend" | "reactivate";
}

/**
 * Suspension is the one action here that an owner feels immediately — their
 * staff stop being able to log in — so it is gated on a written reason rather
 * than a bare confirm. The reason is what the next agent reads when the owner
 * calls back asking why nothing works, and it is what the audit log records.
 *
 * The super-admin check on the calling page is cosmetic; the API is the gate.
 */
export function OwnerLifecycleDialog({ open, onOpenChange, ownerId, ownerName, action }: Props) {
  const suspend = useSuspendOwner(ownerId);
  const reactivate = useReactivateOwner(ownerId);
  const [reason, setReason] = useState("");

  const isSuspend = action === "suspend";
  const mutation = isSuspend ? suspend : reactivate;
  const trimmed = reason.trim();
  const tooShort = trimmed.length < SUSPEND_REASON_MIN_LENGTH;
  const blocked = isSuspend && tooShort;

  function close() {
    setReason("");
    onOpenChange(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;

    const onSettled = {
      onSuccess: () => {
        toast.success(isSuspend ? `${ownerName} suspended` : `${ownerName} reactivated`);
        close();
      },
      onError: (err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : `Could not ${action} this account`,
        ),
    };

    if (isSuspend) suspend.mutate(trimmed, onSettled);
    else reactivate.mutate(trimmed || undefined, onSettled);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSuspend ? "Suspend this account" : "Reactivate this account"}</DialogTitle>
          <DialogDescription>
            {isSuspend
              ? `${ownerName} and their staff will be locked out until an admin reactivates the account. Tenant data is untouched.`
              : `${ownerName} gets access back immediately. The original suspension stays in the audit log.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div>
            <label htmlFor="owner-lifecycle-reason" className="mb-1.5 block text-sm font-medium">
              Reason{isSuspend ? "" : " (optional)"}
            </label>
            <textarea
              id="owner-lifecycle-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              required={isSuspend}
              placeholder={
                isSuspend
                  ? "Chargeback on the Jan invoice; owner unreachable for 3 weeks."
                  : "Payment cleared, owner confirmed on call."
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {isSuspend && reason.length > 0 && tooShort ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {SUSPEND_REASON_MIN_LENGTH - trimmed.length} more characters needed.
              </p>
            ) : null}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Recorded against your name in the audit log.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isSuspend ? "destructive" : "default"}
              disabled={blocked || mutation.isPending}
            >
              {mutation.isPending
                ? isSuspend
                  ? "Suspending…"
                  : "Reactivating…"
                : isSuspend
                  ? "Suspend account"
                  : "Reactivate account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
