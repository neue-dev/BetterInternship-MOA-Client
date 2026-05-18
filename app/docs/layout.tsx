"use client";

import Header from "@/components/docs/Header";
import { Providers } from "./providers";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSignatoryProfile } from "./auth/provider/signatory.ctx";
import { Loader } from "@/components/ui/loader";

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

  if (shouldShowLoadingShell) return <Loader>Loading...</Loader>;

  return shouldBlockRender ? null : <>{children}</>;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditorRoute = pathname?.includes("/editor") ?? false;
  const isFieldsRoute = pathname?.endsWith("/fields") ?? false;
  const isLoginRoute = pathname === "/login" || pathname === "/docs/login";
  const isSignRoute = pathname === "/sign" || pathname === "/docs/sign";
  const showHeader = !isEditorRoute && !isLoginRoute && !isSignRoute;

  return (
    <Providers>
      <div className="flex h-[100svh] w-screen flex-col overflow-hidden bg-white">
        {showHeader && (
          <header className="bg-background/70 sticky top-0 z-50 border-b py-2 backdrop-blur">
            <div className="mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
              {/* Logo */}
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
        )}

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
