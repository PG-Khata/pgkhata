"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BorderBeam } from "@/components/ui/border-beam"
import { toast } from "sonner"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      })
      if (result.error) {
        toast.error(result.error.message || "Invalid credentials")
      } else {
        router.push("/dashboard")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative rounded-xl border bg-card p-6 shadow-sm">
      <BorderBeam
        size={80}
        duration={8}
        colorFrom="#059669"
        colorTo="#10b981"
        borderWidth={1.5}
      />
      <BorderBeam
        size={60}
        duration={12}
        colorFrom="#10b981"
        colorTo="#059669"
        borderWidth={1.5}
        reverse
        delay={4}
      />

      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to access your account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="owner@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
