/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
