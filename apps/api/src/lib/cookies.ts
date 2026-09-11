import type { Request, Response } from "express";

/**
 * This API parses exactly one cookie of its own (better-auth reads the raw
 * header itself), so `cookie-parser` would be a dependency for twelve lines.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// Deliberately mirrors authEnvironmentPolicy().cookieAttributes so a grant
// cookie can never end up laxer than the session cookie it sits beside.
const attributes = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeMs: number,
): void {
  res.cookie(name, value, { ...attributes(), maxAge: maxAgeMs });
}

export function clearSecureCookie(res: Response, name: string): void {
  res.clearCookie(name, attributes());
}
