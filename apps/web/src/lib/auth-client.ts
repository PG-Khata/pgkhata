import { createAuthClient } from "better-auth/react"

const isServer = typeof window === "undefined"

const API_URL = isServer
  ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  : "/api"

export const authClient = createAuthClient({
  baseURL: API_URL,
})

export const { signIn, signUp, signOut, useSession } = authClient
