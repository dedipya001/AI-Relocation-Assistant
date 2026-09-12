/** @type {import('next').NextConfig} */
const isStaticNetlifyPreview = process.env.NETLIFY_STATIC_DEPLOY === "true";

const nextConfig = {
  output: isStaticNetlifyPreview ? "export" : "standalone",
  trailingSlash: isStaticNetlifyPreview,
  images: {
    unoptimized: isStaticNetlifyPreview,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
