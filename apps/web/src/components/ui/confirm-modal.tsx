"use client"

import { useState, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmModalProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setIsPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending || loading}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending || loading}
          >
            {isPending || loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easy confirm dialog usage
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: "default" | "destructive"
    onConfirm: () => void | Promise<void>
  } | null>(null)

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback(
    (options: {
      title: string
      description: string
      confirmLabel?: string
      cancelLabel?: string
      variant?: "default" | "destructive"
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        setState({
          ...options,
          open: true,
          onConfirm: () => {
            resolve(true)
            resolveRef.current = null
          },
        })
      })
    },
    [],
  )

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false)
      resolveRef.current = null
    }
    setState(null)
  }, [])

  const modal = state ? (
    <ConfirmModal
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={state.onConfirm}
    />
  ) : null

  return { confirm, modal }
}
