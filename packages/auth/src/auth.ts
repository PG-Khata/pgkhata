import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@pgkhata/db";
import { sendEmail, passwordResetEmail } from "@pgkhata/email";
import { ensureOwnerProfile, type OwnerProfileWriter } from "./owner-profile";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your PGKhata password",
        html: passwordResetEmail(url),
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensureOwnerProfile(db as unknown as OwnerProfileWriter, user.id);
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    process.env.CORS_ORIGIN || "http://localhost:3000",
    "https://pgkhata-web.onrender.com",
    "http://localhost:3000",
  ],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  cookies: {
    sessionToken: {
      // Secure, cross-site cookies are needed when the web and API apps are
      // deployed on Render. Localhost must use a host-only, non-secure cookie.
      name: isProduction ? "__Secure-better-auth.session_token" : "better-auth.session_token",
      attributes: {
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        ...(isProduction ? { domain: ".onrender.com" } : {}),
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
