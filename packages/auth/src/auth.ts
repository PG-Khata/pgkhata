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

/**
 * Delivery logging for the two emails Better Auth sends itself.
 *
 * "I never got the OTP" is the most common support contact this product takes,
 * and until now it was unanswerable because these two sends left no trace.
 *
 * The writer for the delivery log lives in `apps/api/src/lib/delivery.ts`, and
 * `apps/api` depends on `@pgkhata/auth` — not the reverse. Importing it here
 * would invert that and make the auth package depend on the HTTP app, so
 * instead the write is injected: `apps/api` calls `setAuthDeliveryRecorder`
 * once at startup and this module stays dependency-free.
 *
 * Unwired, the recorder is a no-op and auth behaves exactly as before. That is
 * the point — this is instrumentation, and instrumentation may never be load
 * bearing for a password reset or a sign-in OTP.
 */
export interface AuthDeliveryRecord {
  /** Both auth emails are platform-level, with no property behind them. */
  propertyId: null;
  channel: "email";
  /** Matches the `message_delivery.kind` vocabulary in `@pgkhata/db`. */
  kind: "password_reset" | "otp";
  status: "sent" | "failed";
  recipient: string;
  /** Names the rendered email template, for support triage. */
  template: string;
  error?: string;
}

export type AuthDeliveryRecorder = (record: AuthDeliveryRecord) => void | Promise<void>;

let authDeliveryRecorder: AuthDeliveryRecorder | null = null;

/** Wire the delivery log in. Pass `null` to unwire (tests). */
export function setAuthDeliveryRecorder(recorder: AuthDeliveryRecorder | null): void {
  authDeliveryRecorder = recorder;
}

/**
 * Never throws and never rejects. A failure to log must not turn a delivered
 * OTP into a failed sign-up, which is precisely the outcome an unguarded
 * `await` here would produce the first time the database is briefly unreachable.
 */
async function recordAuthDelivery(record: AuthDeliveryRecord): Promise<void> {
  if (!authDeliveryRecorder) return;
  try {
    await authDeliveryRecorder(record);
  } catch {
    // Swallowed deliberately: see above.
  }
}

function deliveryError(error: unknown): string {
  return error instanceof Error ? error.message : "Email delivery failed";
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const entry = {
        propertyId: null,
        channel: "email",
        kind: "password_reset",
        recipient: user.email,
        template: "password_reset",
      } as const;
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your PGKhata password",
          html: passwordResetEmail(url),
        });
      } catch (error) {
        await recordAuthDelivery({ ...entry, status: "failed", error: deliveryError(error) });
        // Rethrown: Better Auth's own handling of a failed reset email is
        // unchanged by the fact that we now write a log line about it.
        throw error;
      }
      await recordAuthDelivery({ ...entry, status: "sent" });
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
        const entry = {
          propertyId: null,
          channel: "email",
          kind: "otp",
          recipient: email,
          template: "email_verification_otp",
        } as const;
        try {
          await sendEmail({
            to: email,
            subject: "Verify your PGKhata email",
            html: emailVerificationOtpEmail(otp),
          });
        } catch (error) {
          await recordAuthDelivery({ ...entry, status: "failed", error: deliveryError(error) });
          throw error;
        }
        // The OTP itself is never logged — only that an email went out, to whom
        // and whether it left. Support needs the second, never the first.
        await recordAuthDelivery({ ...entry, status: "sent" });
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
