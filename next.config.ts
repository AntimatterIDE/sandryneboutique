import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // globalpayments-api ships conditional requires that can't be statically bundled.
  serverExternalPackages: ["globalpayments-api"],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion/react", "gsap"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "tdijcktimzvgeaozzyjz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
