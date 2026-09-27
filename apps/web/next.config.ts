import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The monorepo root, so file tracing does not wander up to a stray lockfile in the home directory.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // @duel/sdk ships TypeScript source (no build step); Next compiles it like app code.
  transpilePackages: ["@duel/sdk"],
  experimental: { optimizePackageImports: ["@solana/web3.js"] },
  webpack: (config, { webpack }) => {
    // Wallet-adapter and web3.js probe Node built-ins; none are needed in the browser bundle.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    // The SDK imports its own modules as "./x.js" (ESM style) while the files are .ts.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    // Anchor, spl-token and bn.js reach for the global Buffer; hand them the `buffer` package.
    config.plugins.push(new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }));
    return config;
  },
};

export default nextConfig;
