import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack is the default dev bundler in Next.js 16.
    // For production builds, Next.js 16 uses Webpack 6 by default.
  },
  // Prevent the SES lockdown from running in the Next.js Node.js context.
  // The SES sandbox is only activated client-side inside the runtime singleton.
  serverExternalPackages: ["ses", "@ea/runtime"],
};

export default nextConfig;
