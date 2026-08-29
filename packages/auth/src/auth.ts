import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@pgkhata/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:3000"],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
