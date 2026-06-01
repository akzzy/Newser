import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only apply allowedDevOrigins in development to prevent any Vercel/cPanel deployment issues
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['192.168.1.109', '169.254.83.107', '192.168.1.117'],
  }),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
