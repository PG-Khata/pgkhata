"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  required?: boolean
  onSubmit: (value: string) => void | Promise<void>
  loading?: boolean
}

export function PromptModal({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  defaultValue = "",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  required = false,
  onSubmit,
  loading = false,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)
  const [isPending, setIsPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, defaultValue])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (required && !value.trim()) return

    setIsPending(true)
    try {
      await onSubmit(value)
      onOpenChange(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="my-4">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={isPending || loading}
            />
          </div>
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
              type="submit"
              size="sm"
              disabled={isPending || loading || (required && !value.trim())}
            >
              {isPending || loading ? "Processing..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easy prompt dialog usage
export function usePrompt() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    description?: string
    placeholder?: string
    defaultValue?: string
    confirmLabel?: string
    cancelLabel?: string
    required?: boolean
    onSubmit: (value: string) => void | Promise<void>
  } | null>(null)

  const resolveRef = useRef<((value: string | null) => void) | null>(null)

  const prompt = useCallback(
    (options: {
      title: string
      description?: string
      placeholder?: string
      defaultValue?: string
      confirmLabel?: string
      cancelLabel?: string
      required?: boolean
    }): Promise<string | null> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        setState({
          ...options,
          open: true,
          onSubmit: (value) => {
            resolve(value)
            resolveRef.current = null
          },
        })
      })
    },
    [],
  )

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(null)
      resolveRef.current = null
    }
    setState(null)
  }, [])

  const modal = state ? (
    <PromptModal
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
      title={state.title}
      description={state.description}
      placeholder={state.placeholder}
      defaultValue={state.defaultValue}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      required={state.required}
      onSubmit={state.onSubmit}
    />
  ) : null

  return { prompt, modal }
}
