/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve every image as WebP (huge win: product photos are stored as PNG).
    formats: ["image/webp"],
    // Cache each optimized image for 30 days so it's encoded once.
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "https", hostname: "jvjnpfaoqfeodzujsngf.supabase.co" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // Allow the app to be reached through HTTPS dev tunnels (for Meta OAuth).
      allowedOrigins: [
        "localhost:3000",
        "*.trycloudflare.com",
        "*.ngrok-free.app",
        "*.ngrok.io",
      ],
    },
  },
};

export default nextConfig;
