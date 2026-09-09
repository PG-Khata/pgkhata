export function authEnvironmentPolicy(input: { nodeEnv?: string; corsOrigin?: string }) {
  const production = input.nodeEnv === "production";
  if (production && !input.corsOrigin) {
    throw new Error("CORS_ORIGIN is required in production");
  }
  const trustedOrigins = (input.corsOrigin ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    trustedOrigins,
    cookieAttributes: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: production,
      path: "/",
    },
  };
}
