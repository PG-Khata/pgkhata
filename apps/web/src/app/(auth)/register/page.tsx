"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { signUp } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BorderBeam } from "@/components/ui/border-beam"
import { toast } from "sonner"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
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
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      })
      if (result.error) {
        toast.error(result.error.message || "Registration failed")
      } else {
        // Create owner profile via API
        toast.success("Account created")
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
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-muted-foreground">Enter your details to get started.</p>
        </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Full name
          </label>
          <Input id="name" placeholder="Rahul Kumar" {...register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

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
          <label htmlFor="phone" className="text-sm font-medium">
            Phone number
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="9876543210"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
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
          {loading ? "Creating account..." : "Register"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Login
        </Link>
      </p>
    </div>
  </div>
)
}
