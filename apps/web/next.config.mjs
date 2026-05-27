/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["framer-motion"]
  },
  transpilePackages: ["@retrace/config", "@retrace/ui"]
};

export default nextConfig;
