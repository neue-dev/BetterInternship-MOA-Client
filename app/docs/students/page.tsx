"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Users2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSignatoryProfile } from "../auth/provider/signatory.ctx";
import { FormGroupStudentsDetail } from "@/components/docs/students/FormGroupStudentsDetail";
import type { FormGroupMember } from "@/components/docs/students/StudentsTable";
import type { FormGroup } from "@/components/docs/students/types";
import {
  getSignatoryControllerGetSignatoryFormGroupMembersQueryKey,
  getSignatoryControllerGetSignatoryFormGroupsQueryKey,
  formGroupsControllerResetOwnFormGroupCode,
  signatoryControllerClearFormGroupMembers,
  signatoryControllerRemoveFormGroupMember,
  type SignatoryControllerGetSignatoryFormGroupMembersQueryResult,
  type SignatoryControllerGetSignatoryFormGroupsQueryResult,
  useSignatoryControllerGetSignatoryFormGroupMembers,
  useSignatoryControllerGetSignatoryFormGroups,
} from "@/app/api";
import { Loader } from "@/components/ui/loader";

const FORM_GROUPS_STALE_TIME_MS = 60 * 60 * 1000;
const FORM_GROUP_MEMBERS_STALE_TIME_MS = 60 * 60 * 1000;
const FORM_GROUP_QUERY_PARAM = "form-group-id";

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^Error:\s*/, "");
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export default function DocsStudentsPage() {
  const profile = useSignatoryProfile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isLoggedIn = Boolean(profile?.email);
  const {
    data: { formGroups } = { formGroups: [] },
    isLoading,
    isFetching,
    isError: isFormGroupsError,
  } = useSignatoryControllerGetSignatoryFormGroups({
    query: {
      staleTime: FORM_GROUPS_STALE_TIME_MS,
    },
  });
  const [selectedFormGroupId, setSelectedFormGroupId] = useState<string | null>(null);
  const sortedFormGroups = useMemo(
    () => formGroups.toSorted((a, b) => a.description.localeCompare(b.description)),
    [formGroups]
  );
  const {
    data: { formGroupMembers } = { formGroupMembers: [] },
    refetch: refetchFormGroupMembers,
    isFetching: isFetchingFormGroupMembers,
  } = useSignatoryControllerGetSignatoryFormGroupMembers(selectedFormGroupId, {
    query: {
      staleTime: FORM_GROUP_MEMBERS_STALE_TIME_MS,
    },
  });

  const loading = useMemo(() => isLoading || isFetching, [isLoading, isFetching]);
  const sortedFormGroupMembers = formGroupMembers.toSorted((a, b) => {
    const joinedAtA = Date.parse(a.joinedAt) || 0;
    const joinedAtB = Date.parse(b.joinedAt) || 0;

    return joinedAtB - joinedAtA;
  });
  const selectedFormGroup = useMemo(() => {
    return formGroups.find((group) => group.id === selectedFormGroupId) ?? null;
  }, [formGroups, selectedFormGroupId]);

  const updateFormGroupIdInUrl = useCallback(
    (formGroupId: string | null, method: "push" | "replace" = "push") => {
      const currentFormGroupId = searchParams.get(FORM_GROUP_QUERY_PARAM);

      if (currentFormGroupId === formGroupId) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());

      if (formGroupId) {
        nextParams.set(FORM_GROUP_QUERY_PARAM, formGroupId);
      } else {
        nextParams.delete(FORM_GROUP_QUERY_PARAM);
      }

      const queryString = nextParams.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;

      router[method](nextUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (!loading && !profile.loading && isLoggedIn && !profile.coordinatorId) {
      router.push("/dashboard");
    }
  }, [isLoggedIn, profile.coordinatorId, profile.loading, router]);

  useEffect(() => {
    if (isLoading || isFormGroupsError) return;

    const formGroupIdFromUrl = searchParams.get(FORM_GROUP_QUERY_PARAM);
    const fallbackFormGroup = sortedFormGroups[0] ?? null;

    if (!formGroupIdFromUrl) {
      setSelectedFormGroupId(fallbackFormGroup?.id ?? null);

      if (fallbackFormGroup) {
        updateFormGroupIdInUrl(fallbackFormGroup.id, "replace");
      }

      return;
    }

    const formGroupExists = formGroups.some((group) => group.id === formGroupIdFromUrl);

    if (!formGroupExists) {
      setSelectedFormGroupId(fallbackFormGroup?.id ?? null);
      updateFormGroupIdInUrl(fallbackFormGroup?.id ?? null, "replace");
      return;
    }

    setSelectedFormGroupId(formGroupIdFromUrl);
  }, [
    formGroups,
    isFormGroupsError,
    isLoading,
    searchParams,
    sortedFormGroups,
    updateFormGroupIdInUrl,
  ]);

  const handleSelectFormGroup = (formGroup: FormGroup) => {
    setSelectedFormGroupId(formGroup.id);
    updateFormGroupIdInUrl(formGroup.id);
  };

  const copyAccessCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Access code copied.");
    } catch {
      toast.error("Failed to copy access code.");
    }
  };

  const refreshMemberList = useCallback(async () => {
    if (!selectedFormGroupId) {
      toast.error("No form group selected.");
      return;
    }

    try {
      const result = await refetchFormGroupMembers();

      if (result.error) {
        toast.error(getRequestErrorMessage(result.error, "Failed to refresh student list."));
        return;
      }

      if (result.data && !result.data.success) {
        toast.error(result.data.message || "Failed to refresh student list.");
        return;
      }

      toast.success("Student list refreshed.");
    } catch (error) {
      toast.error(getRequestErrorMessage(error, "Failed to refresh student list."));
    }
  }, [refetchFormGroupMembers, selectedFormGroupId]);

  const resetAccessCode = useCallback(async () => {
    if (!selectedFormGroupId) return toast.error("No form group selected.");

    try {
      const response = await formGroupsControllerResetOwnFormGroupCode({
        formGroupId: selectedFormGroupId,
      });

      if (!response.success) {
        toast.error(response.message || "Failed to reset access code.");
        return;
      }

      const code = response.code;

      // This updates the cached value so it reflects properly
      // This is a very common pattern, so find a way to make this easy to replicate
      queryClient.setQueryData<SignatoryControllerGetSignatoryFormGroupsQueryResult>(
        getSignatoryControllerGetSignatoryFormGroupsQueryKey(),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            formGroups: current.formGroups.map((formGroup) =>
              formGroup.id === selectedFormGroupId ? { ...formGroup, code } : formGroup
            ),
          };
        }
      );

      toast.success("Access code reset.");
    } catch (error) {
      toast.error(getRequestErrorMessage(error, "Failed to reset access code."));
    }
  }, [queryClient, selectedFormGroupId]);

  const clearMemberList = useCallback(async () => {
    if (!selectedFormGroupId) return toast.error("No form group selected.");

    try {
      const response = await signatoryControllerClearFormGroupMembers({
        formGroupId: selectedFormGroupId,
      });

      if (!response.success) {
        toast.error(response.message || "Failed to clear student list.");
        return;
      }

      queryClient.setQueryData<SignatoryControllerGetSignatoryFormGroupMembersQueryResult>(
        getSignatoryControllerGetSignatoryFormGroupMembersQueryKey(selectedFormGroupId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            formGroupMembers: [],
          };
        }
      );

      toast.success("Student list cleared.");
    } catch (error) {
      toast.error(getRequestErrorMessage(error, "Failed to clear student list."));
    }
  }, [queryClient, selectedFormGroupId]);

  const removeFormGroupMember = useCallback(
    async (formGroupId: string, userId: string) => {
      try {
        const response = await signatoryControllerRemoveFormGroupMember({
          formGroupId,
          userId,
        });

        if (!response.success) {
          toast.error(response.message || "Failed to remove student.");
          return;
        }

        queryClient.setQueryData<SignatoryControllerGetSignatoryFormGroupMembersQueryResult>(
          getSignatoryControllerGetSignatoryFormGroupMembersQueryKey(formGroupId),
          (current) => {
            if (!current) return current;

            return {
              ...current,
              formGroupMembers: current.formGroupMembers.filter((member) => member.id !== userId),
            };
          }
        );

        toast.success("Student removed.");
      } catch (error) {
        toast.error(getRequestErrorMessage(error, "Failed to remove student."));
      }
    },
    [queryClient]
  );

  if (loading || profile.loading) {
    return <Loader>Loading...</Loader>;
  }

  if (!isLoggedIn || !profile.coordinatorId) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-gray-50">
      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
        {selectedFormGroup ? (
          <FormGroupStudentsDetail
            formGroup={selectedFormGroup as FormGroup}
            formGroups={sortedFormGroups as FormGroup[]}
            members={sortedFormGroupMembers as FormGroupMember[]}
            onSelectFormGroup={handleSelectFormGroup}
            onCopyAccessCode={copyAccessCode}
            onRefreshStudentList={refreshMemberList}
            isRefreshingStudentList={isFetchingFormGroupMembers}
            onResetAccessCode={resetAccessCode}
            onClearStudentList={clearMemberList}
            onRemoveMember={removeFormGroupMember}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-white p-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3 text-gray-500">
              <Users2 className="h-12 w-12 opacity-40" />
              <p className="text-sm">No form groups yet.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
