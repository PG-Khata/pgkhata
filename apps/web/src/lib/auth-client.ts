import { createAuthClient } from "better-auth/react"

if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  baseURL: API_URL,
})

export const { signIn, signUp, signOut, useSession } = authClient
