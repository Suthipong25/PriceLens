import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: [
    "@pricelens/shared",
    "@pricelens/validation",
    "@pricelens/business",
    "@pricelens/database",
    "@pricelens/ingestion",
    "@pricelens/api",
    "@pricelens/api-client",
  ],
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
