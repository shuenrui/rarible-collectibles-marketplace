/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // Linting handled separately; don't block production builds
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Privy v3 pulls in optional Farcaster + Solana peer deps that are not
    // installed. Stub them out so the build does not fail.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
