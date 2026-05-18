"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Menu,
  X as XIcon,
  LogOut,
  ChevronRight,
  Loader2,
  Newspaper,
  Settings,
  SearchCheck,
  LucideArrowRightCircle,
  Users2,
} from "lucide-react";
import { logoutSignatory } from "@/app/api/docs.api";
import { useSignatoryProfile } from "@/app/docs/auth/provider/signatory.ctx";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { Badge } from "../ui/badge";

const ADMIN_BASE_PATH = "/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq";
const ADMIN_LINKS = [
  { href: `${ADMIN_BASE_PATH}/registry`, label: "Registry" },
  { href: `${ADMIN_BASE_PATH}/editor`, label: "Editor" },
  { href: `${ADMIN_BASE_PATH}/create-form`, label: "Create Form" },
  { href: `${ADMIN_BASE_PATH}/fields`, label: "Fields" },
  { href: `${ADMIN_BASE_PATH}/form-groups`, label: "Form Groups" },
  { href: `${ADMIN_BASE_PATH}/sync`, label: "Sync" },
] as const;

export default function DocsTopbarUser() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const profile = useSignatoryProfile();
  const isLoggedIn = Boolean(profile?.email);
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const docsPathname = pathname?.startsWith("/docs/")
    ? pathname.slice("/docs".length)
    : (pathname ?? "/");

  const logoutMutation = useMutation({
    mutationFn: logoutSignatory,
    onSuccess: async () => {
      // Show loading with preset styling
      toast(
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Signing out...</span>
        </div>,
        { ...toastPresets.loading, duration: Infinity }
      );

      // Clear cached auth-dependent data immediately, then refetch profile.
      queryClient.removeQueries({ queryKey: ["my-profile"] });
      queryClient.removeQueries({ queryKey: ["my-forms"] });
      try {
        await queryClient.refetchQueries({ queryKey: ["my-profile"] });
      } catch {
        // Expected to fail with 401 when logout cookie revocation succeeds.
      }

      // Wait a bit for context to update, then redirect
      await new Promise((resolve) => setTimeout(resolve, 200));

      toast.dismiss();
      toast.success("Signed out successfully", { ...toastPresets.success, duration: 2000 });
      router.push("/login");
    },
  });

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  if (!isLoggedIn) {
    return (
      <Link href="/login">
        <Button variant="outline">Login</Button>
      </Link>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isDrawerOpen && (
          <div
            className="z-[30]fixed inset-0 duration-200"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {/* Drawer */}
        <div
          className={cn(
            "fixed top-0 right-0 z-[31] h-[100svh] w-full max-w-[92%] border-l border-gray-200 bg-white shadow-xl sm:max-w-[420px]",
            "transition-transform duration-250 ease-out",
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="mt-1 flex items-center justify-end border-b px-4 py-3">
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                onClick={() => setIsDrawerOpen(false)}
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-gray-900">
                  {profile.name?.trim() || profile.email || "User"}
                </h2>
                <p className="mt-1 truncate text-xs text-gray-500">{profile.email}</p>
                <Badge type="supportive" className="mt-4 w-fit">
                  Coordinator Account
                </Badge>
              </div>

              <Separator className="my-4" />

              {/* Navigation */}
              <nav className="space-y-1">
                <Link href="/dashboard" className="block w-full">
                  <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                    <div className="flex items-center justify-center gap-2">
                      <Newspaper className="h-4 w-4" />
                      <span>Form Signing</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                </Link>

                {profile.coordinatorId && (
                  <Link href="/students" className="block w-full">
                    <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                      <div className="flex items-center justify-center gap-2">
                        <Users2 className="h-4 w-4" />
                        <span>Form Access</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                  </Link>
                )}

                <Link href="/forms" className="block w-full">
                  <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                    <div className="flex items-center justify-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Automation</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                </Link>

                <Link href="/" className="block w-full">
                  <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                    <div className="flex items-center justify-center gap-2">
                      <SearchCheck className="h-4 w-4" />
                      <span>Verifier</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                </Link>

                {profile.god && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold tracking-wider text-gray-600 uppercase">
                      Admin
                    </div>
                    {ADMIN_LINKS.map((link) => (
                      <Link key={link.href} href={link.href} className="block w-full">
                        <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                          <span>{link.label}</span>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </button>
                      </Link>
                    ))}
                  </>
                )}
              </nav>
            </div>

            {/* Footer pinned to bottom */}
            <div className="mt-auto border-t px-4 py-3">
              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2 font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {logoutMutation.isPending ? "Logging out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Header with Menu Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isDrawerOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          >
            {isDrawerOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </>
    );
  }

  // Desktop Layout
  return (
    <div className="flex w-full justify-between gap-2">
      <div className="flex items-center gap-2">
        {profile.god && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="flex items-center gap-1 mt-0.5">
                Admin
                <ChevronDown size={14} className="mt-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ADMIN_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-2">
        {profile?.email ? (
          <>
            <Button
              variant="ghost"
              className={cn(
                "h-auto w-20 flex-col items-center justify-center gap-1 rounded-[0.33em] px-2 py-1",
                docsPathname === "/dashboard"
                  ? "text-primary"
                  : "opacity-80 hover:bg-gray-100 hover:opacity-100"
              )}
              onClick={() => router.push("/dashboard")}
            >
              <Newspaper className="!h-6 !w-6" strokeWidth={1.7} />
              <span className="text-xs">Form Signing</span>
            </Button>
            {profile.coordinatorId && (
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-20 flex-col items-center justify-center gap-1 rounded-[0.33em] px-2 py-1",
                  docsPathname === "/students"
                    ? "text-primary"
                    : "opacity-80 hover:bg-gray-100 hover:opacity-100"
                )}
                onClick={() => router.push("/students")}
              >
                <Users2 className="!h-6 !w-6" strokeWidth={1.7} />
                <span className="text-xs">Form Access</span>
              </Button>
            )}
            <Button
              variant="ghost"
              className={cn(
                "h-auto w-20 flex-col items-center justify-center gap-1 rounded-[0.33em] px-2 py-1",
                docsPathname === "/forms"
                  ? "text-primary"
                  : "opacity-80 hover:bg-gray-100 hover:opacity-100"
              )}
              onClick={() => router.push("/forms")}
            >
              <Settings className="!h-6 !w-6" strokeWidth={1.7} />
              <span className="text-xs">Automation</span>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "h-auto w-20 flex-col items-center justify-center gap-1 rounded-[0.33em] px-2 py-1",
                docsPathname === "/"
                  ? "text-primary"
                  : "opacity-80 hover:bg-gray-100 hover:opacity-100"
              )}
              onClick={() => router.push("/")}
            >
              <SearchCheck className="!h-6 !w-6" strokeWidth={1.7} />
              <span className="text-xs">Verifier</span>
            </Button>
            <Button
              variant="outline"
              scheme="destructive"
              className={cn(
                "h-auto w-20 flex-col items-center justify-center gap-1 rounded-[0.33em] border-0 px-2 py-1"
              )}
              onClick={() => logoutMutation.mutate()}
            >
              <LucideArrowRightCircle className="!h-6 !w-6" strokeWidth={1.7} />
              <span className="text-xs">
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </span>
            </Button>
            <div className="relative flex h-full flex-col justify-center">
              {profile.coordinatorId && (
                <div className="bg-supportive/90 w-full rounded-t-[0.33em] px-3 text-center text-[9px] text-white">
                  <span className="opacity-75">Coordinator Account</span>
                </div>
              )}
              <div
                className={cn(
                  "rounded-[0.33em] border border-gray-300 p-2 px-3 text-xs",
                  profile.coordinatorId ? "rounded-t-none" : ""
                )}
              >
                {profile.name?.trim() || profile.email || "User"}
              </div>
            </div>
          </>
        ) : (
          <Link href="/login">
            <Button variant="outline">Login</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
