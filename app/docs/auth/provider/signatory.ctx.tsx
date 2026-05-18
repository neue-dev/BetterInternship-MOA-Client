/**
 * @ Author: BetterInternship
 * @ Create Time: 2025-12-30 07:06:04
 * @ Modified time: 2026-05-04 23:31:28
 * @ Description:
 *
 * Makes it easier to manage signatory account state across files.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { useIsRestoring, useQuery, keepPreviousData } from "@tanstack/react-query";
import { getSignatorySelf } from "@/app/api/docs.api";

interface ISignatoryProfile {
  id: string;
  email: string;
  name: string;
  autofill: Record<string, Record<string, string>>;
  autoFormPermissions: Record<string, string>;
  signatureImage?: string | null;
  coordinatorId?: string;
  god?: boolean;
  loading?: boolean;
  unauthorized?: boolean;
}

const SignatoryProfileContext = createContext({} as ISignatoryProfile);

export const useSignatoryProfile = () => useContext(SignatoryProfileContext);

function isUnauthorizedError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("unauthorized") ||
    message.includes("invalid or expired signatory token") ||
    message.includes("401") ||
    message.includes("403")
  );
}

export const SignatoryProfileContextProvider = ({ children }: { children: React.ReactNode }) => {
  const isRestoring = useIsRestoring();
  const [signatoryContext, setSignatoryContext] = useState<ISignatoryProfile>({
    loading: true,
    unauthorized: false,
  } as ISignatoryProfile);

  const signatoryProfile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => await getSignatorySelf(),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 1,
  });

  useEffect(() => {
    const profile = signatoryProfile.data?.profile;

    if (isRestoring || signatoryProfile.isPending || (signatoryProfile.isFetching && !profile)) {
      setSignatoryContext((prev) => ({
        ...prev,
        loading: true,
        unauthorized: false,
      }));
      return;
    }

    if (signatoryProfile.status === "error") {
      if (isUnauthorizedError(signatoryProfile.error)) {
        setSignatoryContext({
          loading: false,
          unauthorized: true,
        } as ISignatoryProfile);
        return;
      }

      // Preserve last known profile for transient/network errors.
      setSignatoryContext((prev) => ({ ...prev, loading: false }));
      return;
    }

    if (!profile) {
      setSignatoryContext((prev) => ({
        ...prev,
        loading: true,
        unauthorized: false,
      }));
    } else if (profile) {
      setSignatoryContext({
        ...profile,
        autofill: profile.autofill as Record<string, Record<string, string>>,
        autoFormPermissions: profile.autoFormPermissions as Record<string, string>,
        loading: false,
        unauthorized: false,
      });
    }
  }, [
    isRestoring,
    signatoryProfile.data,
    signatoryProfile.status,
    signatoryProfile.error,
    signatoryProfile.isPending,
    signatoryProfile.isFetching,
  ]);

  return (
    <SignatoryProfileContext.Provider value={signatoryContext}>
      {children}
    </SignatoryProfileContext.Provider>
  );
};
