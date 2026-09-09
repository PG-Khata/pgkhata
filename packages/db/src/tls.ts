export function databaseSslConfig(input: {
  databaseUrl: string;
  nodeEnv?: string;
  sslMode?: string;
}) {
  const databaseUrl = new URL(input.databaseUrl);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname);
  const disableTls = input.sslMode === "disable";

  if (disableTls && (input.nodeEnv === "production" || !isLocal)) {
    throw new Error("DB_SSL_MODE=disable is allowed only for a local non-production database");
  }

  return disableTls || (isLocal && !databaseUrl.searchParams.has("sslmode"))
    ? false
    : { rejectUnauthorized: true as const };
}
