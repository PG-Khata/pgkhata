import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function ImpersonateFailedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
          <ShieldAlert className="h-6 w-6 text-amber-700" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Support link expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Support links can only be used once and expire after a minute. Start a new support
          session from the admin console.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
