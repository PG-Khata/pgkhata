import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // Configuration will be added in Task 3
});

export type Session = typeof auth.$Infer.Session;
