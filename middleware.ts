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
  "uni.moa.betterinternship.com": "univ",
  "dev.uni.moa.betterinternship.com": "univ",
  "univ.localhost": "univ",
  "docs.localhost": "docs",
  "docs.betterinternship.com": "docs",
  "dev.docs.betterinternship.com": "docs",
};

export function middleware(req: NextRequest) {
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
