import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@pgkhata/db";
import { sendEmail, passwordResetEmail, emailVerificationOtpEmail } from "@pgkhata/email";
import { ensureOwnerProfile, type OwnerProfileWriter } from "./owner-profile";
import { authEnvironmentPolicy } from "./security-policy";

const isTest = process.env.NODE_ENV === "test";
const environmentPolicy = authEnvironmentPolicy({
  nodeEnv: process.env.NODE_ENV,
  corsOrigin: process.env.CORS_ORIGIN,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
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
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: "hashed",
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return;
        await sendEmail({
          to: email,
          subject: "Verify your PGKhata email",
          html: emailVerificationOtpEmail(otp),
        });
      },
    }),
  ],
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: isTest ? 10_000 : 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: isTest ? 10_000 : 50 },
      "/request-password-reset": { window: 15 * 60, max: 3 },
    },
  },
  trustedOrigins: environmentPolicy.trustedOrigins,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  advanced: {
    defaultCookieAttributes: environmentPolicy.cookieAttributes,
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
