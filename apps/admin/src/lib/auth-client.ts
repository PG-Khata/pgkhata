import { createAuthClient } from "better-auth/react";

const webOrigin =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"
    : window.location.origin;

export const authClient = createAuthClient({
  baseURL: `${webOrigin}/api/backend/api/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;
