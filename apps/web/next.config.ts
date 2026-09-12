import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // No rewrites needed - using full API URL with credentials: 'include'
  //
  // distDir is overridable via NEXT_DIST_DIR so the Playwright E2E build/start
  // can use an isolated output dir (.next-e2e) and not clobber a running
  // `next dev` session's .next. Defaults to the normal ".next".
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
}

export default nextConfig
