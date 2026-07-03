/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./prisma/data/**/*"],
    "/api/*": ["./data/**/*", "./prisma/data/**/*"],
    "/api/data": ["./data/**/*", "./prisma/data/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" }
  }
};

export default nextConfig;
