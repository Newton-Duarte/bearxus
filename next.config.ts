import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  logging: {
    incomingRequests: { ignore: [/\/api\/auth\/verify-email(?:\?|$)/, /\/reset-password(?:\?|$)/] },
    serverFunctions: false,
  },
  headers: async () => [{
    source: "/reset-password",
    headers: [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ],
  }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
