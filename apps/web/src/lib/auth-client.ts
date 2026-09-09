import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"

const webOrigin = typeof window === "undefined"
  ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  : window.location.origin

export const authClient = createAuthClient({
  baseURL: `${webOrigin}/api/backend/api/auth`,
  plugins: [emailOTPClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
