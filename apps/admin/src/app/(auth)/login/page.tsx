"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_EMAIL_DOMAIN, toAdminEmail } from "@/lib/admin-email";

type Step = "email" | "signin" | "create";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  /** Signing in proves identity, not privilege — a non-admin would otherwise be
   * bounced straight back by the layout gate, looking like a broken login. */
  async function finishAdminLogin() {
    const me = await fetch("/api/backend/v1/admin/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (!me.ok) {
      await signOut();
      toast.error("This account does not have platform admin access.");
      return;
    }
    const next = searchParams.get("next");
    router.push(next?.startsWith("/") ? next : "/dashboard");
  }

  // Step 1: ask the API whether this account still needs its first password.
  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/backend/v1/admin-auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toAdminEmail(email) }),
      });
      const body = (await res.json().catch(() => ({}))) as { needsPassword?: boolean };
      setStep(body.needsPassword ? "create" : "signin");
    } catch {
      // If the check itself fails, fall through to the ordinary password form
      // rather than blocking a real admin from signing in.
      setStep("signin");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email: toAdminEmail(email), password });
      if (result.error) {
        toast.error(result.error.message || "Login failed");
        return;
      }
      await finishAdminLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // First-login: set the password, then sign in with it.
  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/backend/v1/admin-auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toAdminEmail(email), password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "Could not set password");
        return;
      }
      const result = await signIn.email({ email: toAdminEmail(email), password });
      if (result.error) {
        toast.error(result.error.message || "Password set, but sign-in failed. Try signing in.");
        setStep("signin");
        return;
      }
      await finishAdminLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">PGKhata Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Platform administration</p>
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you or you@${ADMIN_EMAIL_DOMAIN}`}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Just your alias is fine — <code>@{ADMIN_EMAIL_DOMAIN}</code> is added for you.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? "Checking..." : "Continue"}
            </Button>
          </form>
        )}

        {step === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <EmailPill email={toAdminEmail(email)} onChange={changeEmail} />
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        )}

        {step === "create" && (
          <form onSubmit={handleCreatePassword} className="space-y-4">
            <EmailPill email={toAdminEmail(email)} onChange={changeEmail} />
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              First time signing in — set a password for this account.
            </p>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">
                New password
              </label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">
                Confirm password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter the password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || password.length < 8}>
              {loading ? "Setting up..." : "Set password & sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function EmailPill({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{email}</span>
    </button>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary during prerendering.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
