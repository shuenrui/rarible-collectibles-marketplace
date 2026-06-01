/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // Linting handled separately; don't block production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
