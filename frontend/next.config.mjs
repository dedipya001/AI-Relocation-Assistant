const isGithubPages = process.env.GITHUB_ACTIONS === "true";
const repoName = "AI-Relocation-Assistant";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: isGithubPages ? `/${repoName}` : "",
  assetPrefix: isGithubPages ? `/${repoName}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
