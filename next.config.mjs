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
      // Files served from our own server (MinIO behind Caddy).
      { protocol: "https", hostname: "srv2120209.hstgr.cloud", pathname: "/media/**" },
      // Product photos from Shopify, resized for phones by our image endpoint.
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // HTTPS dev tunnels (for testing Meta OAuth) may post forms only on a developer's own
      // machine. On the live site, anyone can open a tunnel address, so they're not trusted there.
      allowedOrigins:
        process.env.NODE_ENV === "development"
          ? ["localhost:3000", "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"]
          : [],
    },
  },
};

export default nextConfig;
