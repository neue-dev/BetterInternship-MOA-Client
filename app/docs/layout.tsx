"use client";

import Header from "@/components/docs/Header";
import { Providers } from "./providers";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSignatoryProfile } from "./auth/provider/signatory.ctx";
import { ChevronDown } from "lucide-react";

const PUBLIC_ROUTE_PREFIXES = ["/login", "/sign-in", "/auth/magic-link"];
const ROUTE_ACCESS_RULES = [
  { prefix: "/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq", requireGod: true },
  { prefix: "/dashboard" },
  { prefix: "/forms" },
  { prefix: "/students" },
] as const;

function normalizeDocsPath(pathname: string) {
  return pathname.startsWith("/docs/") ? pathname.slice("/docs".length) : pathname;
}

function routeMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getDocsRouteAccess(pathname: string) {
  const isPublic = PUBLIC_ROUTE_PREFIXES.some((prefix) => routeMatches(pathname, prefix));
  const rule = ROUTE_ACCESS_RULES.find(({ prefix }) => routeMatches(pathname, prefix));

  return {
    requiresAuth: Boolean(!isPublic && rule),
    requiresGod: Boolean(!isPublic && rule?.requireGod),
  };
}

function DocsAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useSignatoryProfile();
  const normalizedPath = normalizeDocsPath(pathname ?? "/");
  const { requiresAuth, requiresGod } = getDocsRouteAccess(normalizedPath);
  const profileLoaded = !profile.loading;
  const isUnauthorized = requiresAuth && profileLoaded && profile.unauthorized;
  const isMissingGodAccess = requiresGod && profileLoaded && !profile.unauthorized && !profile.god;
  const redirectPath = isUnauthorized ? "/login" : isMissingGodAccess ? "/dashboard" : null;
  const shouldBlockRender =
    requiresAuth && (profile.loading || isUnauthorized || isMissingGodAccess);
  const shouldShowLoadingShell = requiresAuth && profile.loading;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  if (shouldShowLoadingShell) return null;

  return shouldBlockRender ? null : <>{children}</>;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditorRoute = pathname?.includes("/editor") ?? false;
  const isFieldsRoute = pathname?.endsWith("/fields") ?? false;
  const isLoginRoute = pathname === "/login" || pathname === "/docs/login";
  const isSignRoute = pathname === "/sign" || pathname === "/docs/sign";
  const showHeader = !isLoginRoute && !isSignRoute;

  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderEnter = useCallback(() => {
    if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
    setIsHeaderVisible(true);
  }, []);

  const handleHeaderLeave = useCallback(() => {
    headerTimerRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 300);
  }, []);

  const headerContent = (
    <header className="bg-background/70 border-b py-2 backdrop-blur">
      <div className="mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="block flex-shrink-0 border-none text-black! outline-none focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <img
              src="/betterinternship-logo.png"
              alt="Logo"
              width={25}
              height={25}
              className="flex-none"
            />
            <h1 className="font-display flex flex-row items-center space-x-2 text-lg font-bold text-gray-900">
              BetterInternship
            </h1>
          </div>
        </Link>

        <div className="flex flex-1 justify-end gap-2">
          <Header />
        </div>
      </div>
    </header>
  );

  return (
    <Providers>
      <div className="flex h-[100svh] w-screen flex-col overflow-hidden bg-white">
        {showHeader &&
          (isEditorRoute ? (
            <>
              <div
                className={`fixed top-0 left-1/2 z-50 -translate-x-1/2 transition-opacity ${
                  isHeaderVisible ? "pointer-events-none opacity-0" : ""
                }`}
                onMouseEnter={handleHeaderEnter}
              >
                <div className="flex h-4 w-8 items-center justify-center rounded-b border border-t-0 border-slate-200 bg-white/90 shadow-sm">
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </div>
              </div>
              <div
                className={`fixed inset-x-0 top-0 z-50 transition-transform duration-200 ${
                  isHeaderVisible ? "" : "-translate-y-full"
                }`}
                onMouseEnter={handleHeaderEnter}
                onMouseLeave={handleHeaderLeave}
              >
                {headerContent}
              </div>
            </>
          ) : (
            <div className="sticky top-0 z-50">{headerContent}</div>
          ))}

        <main
          className={`mx-auto flex min-h-0 w-full flex-1 ${
            isFieldsRoute ? "overflow-hidden" : "overflow-auto"
          }`}
        >
          <DocsAuthGate>{children}</DocsAuthGate>
        </main>
      </div>
    </Providers>
  );
}
