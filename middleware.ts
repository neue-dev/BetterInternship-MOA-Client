import { NextRequest, NextResponse } from "next/server";

export const config = {
  // run on everything except static files and api
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};

function getHost(req: NextRequest) {
  const h = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return h.split(":")[0].toLowerCase();
}

// ! to fix: make sure these are env variable mappings instead
const SUBPATH_BY_HOST: Record<string, string> = {
  "docs.localhost": "docs",
  "docs.betterinternship.com": "docs",
  "dev.docs.betterinternship.com": "docs",
};

export function middleware(req: NextRequest) {
  // csp allowed connections
  const apiUrls = [
    process.env.NEXT_PUBLIC_DOCS_URL,
    process.env.NEXT_PUBLIC_API_SERVER_URL,
  ].filter(Boolean);

  const connectOrigins = apiUrls
    .map((url) => {
      try {
        const parsed = new URL(url!);
        const origin = parsed.origin;
        if (origin.startsWith("https://")) {
          return `${origin} ${origin.replace("https://", "wss://")}`;
        }
        if (origin.startsWith("http://")) {
          return `${origin} ${origin.replace("http://", "ws://")}`;
        }
        return origin;
      } catch (e) {
        return "";
      }
    })
    .filter(Boolean)
    .join(" ");

  // csp
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    connect-src 'self' http://localhost:* ${connectOrigins};
    frame-src 'self' http://localhost:* ${connectOrigins};
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  // routing
  const host = getHost(req);
  const subpath = SUBPATH_BY_HOST[host];

  if (!subpath) return NextResponse.next();

  const url = req.nextUrl;

  // avoid loops if already prefixed (/moa or /univ)
  if (url.pathname === `/${subpath}` || url.pathname.startsWith(`/${subpath}/`)) {
    return NextResponse.next();
  }

  // rewrite to the corresponding app subfolder while keeping the visible URL
  const rewritten = new URL(`/${subpath}${url.pathname}${url.search}`, req.url);
  return NextResponse.rewrite(rewritten);
}
