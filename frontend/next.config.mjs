/** @type {import('next').NextConfig} */
const isStaticNetlifyPreview = process.env.NETLIFY_STATIC_DEPLOY === "true";
const backendUrl =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : "https://ai-relocation-assistant.vercel.app");

const nextConfig = {
  ...(isStaticNetlifyPreview
    ? {
        output: "export",
        trailingSlash: true,
      }
    : {}),
  ...(!isStaticNetlifyPreview && backendUrl
    ? {
        async rewrites() {
          return [
            {
              source: "/api/v1/:path*",
              destination: `${backendUrl.replace(/\/$/, "")}/api/v1/:path*`,
            },
          ];
        },
      }
    : {}),
  images: {
    unoptimized: isStaticNetlifyPreview,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
