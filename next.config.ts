import type { NextConfig } from "next";

const apiUrls = [
  process.env.NEXT_PUBLIC_DOCS_URL,
  process.env.NEXT_PUBLIC_API_SERVER_URL,
  "https://storage.googleapis.com/better-internship-public-bucket",
].filter(Boolean);

const connectOrigins = apiUrls
  .map((url) => {
    try {
      const parsed = new URL(url);
      const origin = parsed.origin;
      if (origin.startsWith("https://")) {
        return `${origin} ${origin.replace("https://", "wss://")}`;
      }
      if (origin.startsWith("http://")) {
        return `${origin} ${origin.replace("http://", "ws://")}`;
      }
      return origin;
    } catch {
      return "";
    }
  })
  .filter(Boolean)
  .join(" ");

const imageOrigins = apiUrls
  .map((url) => {
    try {
      return new URL(url).origin;
    } catch (e) {
      return "";
    }
  })
  .filter(Boolean)
  .join(" ");

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com;
  frame-src 'self' http://localhost:* ${connectOrigins};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: http://localhost:* ${imageOrigins};
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' http://localhost:* ${connectOrigins};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, "");

const isDev = process.env.DEVELOPMENT_ENV == "true";

const docsHosts = ["docs.localhost", "docs.betterinternship.com", "dev.docs.betterinternship.com"];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: isDev,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: docsHosts.map((host) => ({
        source: "/:path((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml)(?!.*\\.).*)",
        has: [{ type: "host", value: host }],
        destination: "/docs/:path*",
      })),
    };
  },
};

export default nextConfig;
