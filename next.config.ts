import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  output: "standalone",
  // Payload laster drizzle-kit dynamisk (skjema-push). Fil-sporingen ser det ikke, så vi tvinger
  // pakken med i standalone-bygget (Docker). pnpm: både symlinken og den reelle mappen.
  serverExternalPackages: ["drizzle-kit"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/drizzle-kit/**", "./node_modules/.pnpm/drizzle-kit@*/**"],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};

export default withPayload(nextConfig);
