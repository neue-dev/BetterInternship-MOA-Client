"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { HeaderIcon, HeaderText } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useFormsControllerGetRegistry } from "@/app/api";
import {
  addFormToGroup,
  assignCoordinatorToFormGroup,
  createFormGroup,
  fetchAllFormGroups,
  removeFormsFromGroup,
  resetFormGroupCode,
} from "@/app/api/forms.api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useModal } from "@/app/providers/modal-provider";
import { AccessCodeCopy } from "@/components/docs/students/AccessCodeCopy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORM_GROUPS_QUERY_KEY = ["FormGroupsController_GetAllFormGroups"];

interface FormGroup {
  id: string;
  name?: string;
  forms?: string[];
  description?: string;
  code?: string | null;
  coordinator_id?: string | null;
  coordinator_email?: string | null;
}

interface FormOption {
  name: string;
  label?: string;
  version?: number;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message.replace(/^Error:\s*/, "");
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

function CreateFormGroupModalContent({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return toast.error("Please enter a form group name.");

    setIsSubmitting(true);
    try {
      await onSubmit(trimmedName);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Form group name"
        className="h-9 text-sm"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") void handleCreate();
        }}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={!name.trim() || isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
          Create
        </Button>
      </div>
    </div>
  );
}

function AssignCoordinatorModalContent({
  group,
  onSubmit,
  onClose,
}: {
  group: FormGroup;
  onSubmit: (email: string) => Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssign = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return toast.error("Please enter a signatory email.");

    setIsSubmitting(true);
    try {
      await onSubmit(normalizedEmail);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">
          {group.description || `Group ${group.id.slice(0, 8)}`}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Enter an existing signatory email to promote it to a coordinator account.
        </p>
      </div>

      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="signatory@example.com"
        className="h-9 text-sm"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") void handleAssign();
        }}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleAssign} disabled={!email.trim() || isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
          Assign
        </Button>
      </div>
    </div>
  );
}

function AddFormModalContent({
  forms,
  onSubmit,
  onClose,
}: {
  forms: FormOption[];
  onSubmit: (formNames: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredForms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return forms;
    return forms.filter(
      (form) =>
        form.name.toLowerCase().includes(query) ||
        (form.label || "").toLowerCase().includes(query) ||
        String(form.version || "").includes(query)
    );
  }, [forms, searchQuery]);

  const handleAdd = async () => {
    if (!selectedForms.length) return toast.error("Please select at least one form");

    setIsSubmitting(true);
    try {
      await onSubmit(selectedForms);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectedForm = (formName: string) => {
    setSelectedForms((prev) =>
      prev.includes(formName) ? prev.filter((name) => name !== formName) : [...prev, formName]
    );
  };

  return (
    <div className="space-y-3">
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search forms..."
        className="h-9 text-sm"
        autoFocus
      />

      <div className="h-72 overflow-auto rounded-md border border-slate-200">
        {forms.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-sm text-slate-500">
            No forms available
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-sm text-slate-500">
            No forms match your search
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredForms.map((form) => {
              const isSelected = selectedForms.includes(form.name);
              return (
                <button
                  key={form.name}
                  type="button"
                  onClick={() => toggleSelectedForm(form.name)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-3">
                    {form.label || form.name} (v{form.version})
                  </span>
                  {isSelected ? <Check className="h-4 w-4 flex-shrink-0 text-slate-700" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="mb-1 text-xs font-semibold text-slate-700">
          Forms to be added ({selectedForms.length})
        </p>
        {selectedForms.length === 0 ? (
          <p className="text-xs text-slate-500">No forms selected.</p>
        ) : (
          <p className="text-xs text-slate-600">{selectedForms.join(", ")}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleAdd} disabled={!selectedForms.length || isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
          Add Selected
        </Button>
      </div>
    </div>
  );
}

function RemoveFormModalContent({
  forms,
  onSubmit,
  onClose,
}: {
  forms: FormOption[];
  onSubmit: (formNames: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredForms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return forms;
    return forms.filter(
      (form) =>
        form.name.toLowerCase().includes(query) ||
        (form.label || "").toLowerCase().includes(query) ||
        String(form.version || "").includes(query)
    );
  }, [forms, searchQuery]);

  const handleDelete = async () => {
    if (!selectedForms.length) return toast.error("Please select at least one form");

    setIsSubmitting(true);
    try {
      await onSubmit(selectedForms);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectedForm = (formName: string) => {
    setSelectedForms((prev) =>
      prev.includes(formName) ? prev.filter((name) => name !== formName) : [...prev, formName]
    );
  };

  return (
    <div className="space-y-3">
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search forms..."
        className="h-9 text-sm"
        autoFocus
      />

      <div className="h-72 overflow-auto rounded-md border border-slate-200">
        {forms.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-sm text-slate-500">
            No forms available in this group
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-sm text-slate-500">
            No forms match your search
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredForms.map((form) => {
              const isSelected = selectedForms.includes(form.name);
              return (
                <button
                  key={form.name}
                  type="button"
                  onClick={() => toggleSelectedForm(form.name)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? "bg-rose-50 text-rose-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-3">
                    {form.label || form.name} (v{form.version})
                  </span>
                  {isSelected ? <Check className="h-4 w-4 flex-shrink-0 text-rose-700" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-rose-50 px-3 py-2">
        <p className="mb-1 text-xs font-semibold text-rose-800">
          Forms to be deleted ({selectedForms.length})
        </p>
        {selectedForms.length === 0 ? (
          <p className="text-xs text-rose-700/70">No forms selected.</p>
        ) : (
          <p className="text-xs text-rose-700">{selectedForms.join(", ")}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          size="sm"
          scheme="destructive"
          onClick={handleDelete}
          disabled={!selectedForms.length || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
          Delete Selected
        </Button>
      </div>
    </div>
  );
}

export default function FormGroupsPage() {
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupPendingCodeReset, setGroupPendingCodeReset] = useState<FormGroup | null>(null);

  const formRegistry = useFormsControllerGetRegistry();
  const rawForms = formRegistry.data?.registry ?? [];
  const allForms = [...rawForms].sort((a, b) => a.name.localeCompare(b.name));

  const { data: groupsData } = useQuery({
    queryKey: FORM_GROUPS_QUERY_KEY,
    queryFn: fetchAllFormGroups,
  });

  const formGroups = ((groupsData?.groups || []) as FormGroup[]).toSorted((a, b) =>
    (a.description || a.name || a.id).localeCompare(b.description || b.name || b.id)
  );

  const invalidateFormGroups = () =>
    queryClient.invalidateQueries({ queryKey: FORM_GROUPS_QUERY_KEY });

  const createFormGroupMutation = useMutation({
    mutationFn: (name: string) => createFormGroup(name),
    onSuccess: async (response) => {
      if (response.error || (response.group && response.group.success === false)) {
        toast.error(
          getRequestErrorMessage(response.error || response.group, "Failed to create form group")
        );
        return;
      }

      toast.success("Form group created successfully");
      await invalidateFormGroups();
    },
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, "Failed to create form group"));
    },
  });

  const assignCoordinatorMutation = useMutation({
    mutationFn: ({ formGroupId, email }: { formGroupId: string; email: string }) =>
      assignCoordinatorToFormGroup(formGroupId, email),
    onSuccess: async (response) => {
      if (response.error || (response.result && response.result.success === false)) {
        toast.error(
          getRequestErrorMessage(response.error || response.result, "Failed to assign coordinator")
        );
        return;
      }

      toast.success("Coordinator assigned successfully");
      await invalidateFormGroups();
    },
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, "Failed to assign coordinator"));
    },
  });

  const resetCodeMutation = useMutation({
    mutationFn: (formGroupId: string) => resetFormGroupCode(formGroupId),
    onSuccess: async (response) => {
      if (response.error || (response.result && response.result.success === false)) {
        toast.error(
          getRequestErrorMessage(response.error || response.result, "Failed to reset access code")
        );
        return;
      }

      toast.success("Access code reset");
      await invalidateFormGroups();
    },
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, "Failed to reset access code"));
    },
  });

  const addFormMutation = useMutation({
    mutationFn: ({ formNames, groupId }: { formNames: string[]; groupId: string }) =>
      addFormToGroup(formNames, groupId),
    onSuccess: async () => {
      toast.success("Form added to group successfully");
      await invalidateFormGroups();
    },
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, "Failed to add form to group"));
    },
  });

  const removeFormsMutation = useMutation({
    mutationFn: ({ formNames, groupId }: { formNames: string[]; groupId: string }) =>
      removeFormsFromGroup(formNames, groupId),
    onSuccess: async () => {
      toast.success("Form(s) removed from group successfully");
      await invalidateFormGroups();
    },
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, "Failed to remove form(s) from group"));
    },
  });

  const copyAccessCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Access code copied.");
    } catch {
      toast.error("Failed to copy access code.");
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };

  const openCreateFormGroupModal = () => {
    const modalKey = "form-groups:create";
    openModal(
      modalKey,
      <CreateFormGroupModalContent
        onSubmit={(name) => createFormGroupMutation.mutateAsync(name).then(() => undefined)}
        onClose={() => closeModal(modalKey)}
      />,
      {
        title: "Create Form Group",
        panelClassName: "sm:w-[440px] sm:min-w-[440px] sm:max-w-[440px]",
        contentClassName: "w-full px-4 pb-4 pt-2",
      }
    );
  };

  const openAssignCoordinatorModal = (group: FormGroup) => {
    const modalKey = "form-groups:assign-coordinator";
    openModal(
      modalKey,
      <AssignCoordinatorModalContent
        group={group}
        onSubmit={(email) =>
          assignCoordinatorMutation
            .mutateAsync({ formGroupId: group.id, email })
            .then(() => undefined)
        }
        onClose={() => closeModal(modalKey)}
      />,
      {
        title: "Assign Coordinator",
        panelClassName: "sm:w-[520px] sm:min-w-[520px] sm:max-w-[520px]",
        contentClassName: "w-full px-4 pb-4 pt-2",
      }
    );
  };

  const openAddFormModal = (groupId: string) => {
    const modalKey = "form-groups:add-form";
    openModal(
      modalKey,
      <AddFormModalContent
        forms={allForms}
        onSubmit={(formNames) =>
          addFormMutation.mutateAsync({ formNames, groupId }).then(() => undefined)
        }
        onClose={() => closeModal(modalKey)}
      />,
      {
        title: "Add Form",
        panelClassName: "sm:w-[640px] sm:min-w-[640px] sm:max-w-[640px]",
        contentClassName: "w-full px-4 pb-4 pt-2",
      }
    );
  };

  const openRemoveFormModal = (groupId: string, groupFormNames: string[]) => {
    const modalKey = "form-groups:remove-form";
    const groupForms: FormOption[] = groupFormNames.map((formName) => {
      const formInfo = allForms.find((f) => f.name === formName);
      return {
        name: formName,
        label: formInfo?.label || formName,
        version: formInfo?.version || 0,
      };
    });

    openModal(
      modalKey,
      <RemoveFormModalContent
        forms={groupForms}
        onSubmit={(formNames) =>
          removeFormsMutation.mutateAsync({ formNames, groupId }).then(() => undefined)
        }
        onClose={() => closeModal(modalKey)}
      />,
      {
        title: "Remove Form",
        panelClassName: "sm:w-[640px] sm:min-w-[640px] sm:max-w-[640px]",
        contentClassName: "w-full px-4 pb-4 pt-2",
      }
    );
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl bg-white">
      <AlertDialog
        open={Boolean(groupPendingCodeReset)}
        onOpenChange={(open) => {
          if (!open) setGroupPendingCodeReset(null);
        }}
      >
        <AlertDialogContent variant="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset access code?</AlertDialogTitle>
            <AlertDialogDescription>
              Any students who have not joined{" "}
              {groupPendingCodeReset?.description ||
                (groupPendingCodeReset
                  ? `Group ${groupPendingCodeReset.id.slice(0, 8)}`
                  : "this group")}{" "}
              will need the new code to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              scheme="destructive"
              onClick={() => {
                if (groupPendingCodeReset) resetCodeMutation.mutate(groupPendingCodeReset.id);
                setGroupPendingCodeReset(null);
              }}
            >
              Reset Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full border-b border-slate-200">
        <div className="w-full py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <HeaderIcon icon={FolderOpen} />
              <div>
                <HeaderText>Student Form Access</HeaderText>
              </div>
            </div>
            <Button onClick={openCreateFormGroupModal} className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" />
              Create Form Group
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full py-6">
        <div className="mx-auto w-full max-w-7xl">
          {formGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">No form groups yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {formGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const groupName = group.description || `Group ${group.id.slice(0, 8)}`;
                return (
                  <Card key={group.id} className="overflow-hidden border-slate-200 shadow-none">
                    <button type="button" onClick={() => toggleGroup(group.id)} className="w-full">
                      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                          <div className="min-w-0 text-left">
                            <h3 className="truncate text-sm font-medium text-slate-900">
                              {groupName}
                            </h3>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {group.forms?.length || 0} forms
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="min-w-0 truncate">
                                  {group.coordinator_email ||
                                    (group.coordinator_id
                                      ? "Coordinator assigned"
                                      : "No coordinator")}
                                </span>
                                <button
                                  type="button"
                                  title="Edit coordinator"
                                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAssignCoordinatorModal(group);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {group.code ? (
                            <AccessCodeCopy
                              code={group.code}
                              onCopy={copyAccessCode}
                              stopPropagation
                              className="text-xs"
                            />
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
                              No code
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label={`Manage ${groupName}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                Edit Forms
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddFormModal(group.id);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Add forms
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={!group.forms || group.forms.length === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRemoveFormModal(group.id, group.forms || []);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete forms
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`More actions for ${groupName}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                disabled={resetCodeMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGroupPendingCodeReset(group);
                                }}
                              >
                                <KeyRound className="h-4 w-4" />
                                Reset code
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className=" border-slate-200 px-12">
                        {group.forms && group.forms.length > 0 ? (
                          <div className="">
                            {group.forms.map((formName) => {
                              const formInfo = allForms.find((f) => f.name === formName);
                              return (
                                <div
                                  key={formName}
                                  className="flex items-center gap-2 py-1.5 text-xs"
                                >
                                  <span className="text-slate-700">
                                    {formInfo?.label || formName}
                                  </span>
                                  {formInfo?.version ? (
                                    <span className="shrink-0 text-slate-400">
                                      v{formInfo.version}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="py-2 text-xs text-slate-500">No forms</p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
