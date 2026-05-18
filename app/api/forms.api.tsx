import { formGroupsControllerGetAllFormGroups } from "./app/api/endpoints/form-groups/form-groups";
import { formsControllerGetLatestFormDocumentAndMetadata } from "./app/api/endpoints/forms/forms";
import { signatoryControllerGetSignedDocumentsBySignatory } from "./app/api/endpoints/signatory/signatory";
import {
  formGroupsControllerAddFormToGroup,
  formGroupsControllerAssignCoordinatorToFormGroup,
  formGroupsControllerCreateFormGroup,
  formGroupsControllerRemoveFormFromGroup,
  formGroupsControllerResetFormGroupCode,
} from "./app/api/endpoints/form-groups/form-groups";
export const getFormFields = async (name: string) => {
  return await formsControllerGetLatestFormDocumentAndMetadata({ name });
};

export type ApproveSignatoryRequest = {
  pendingFormId: string;
  values?: Record<string, string>;
};

export type ApproveSignatoryResponse = {
  message?: string;
  signedDocumentId?: string;
  signedDocumentUrl?: string;
  [k: string]: any;
};

export const getAllSignedForms = async () => {
  return await signatoryControllerGetSignedDocumentsBySignatory();
};

export const requestGenerateForm = async (data: {
  formName: string;
  formVersion?: number;
  values: Record<string, string>;
  signatories?: { name: string; title: string }[];
  parties?: {
    userId?: string | null;
    employerId?: string | null;
    universityId?: string | null;
  };
  disableEsign?: boolean;
}) => {
  try {
    // ! reimplement this part, call the correct route
    await Promise.resolve("lol");
    return { response: {}, isLoading: false, error: null };
  } catch (error) {
    return { response: null, isLoading: false, error };
  }
};

export const fetchAllFormGroups = async () => {
  try {
    const res = await formGroupsControllerGetAllFormGroups();
    const groups = (res as any)?.groups ?? [];
    return { groups, isLoading: false, error: null };
  } catch (error) {
    return { groups: null, isLoading: false, error };
  }
};

export const createFormGroup = async (name: string) => {
  try {
    const res = await formGroupsControllerCreateFormGroup({
      name,
    });
    const group = res ?? null;
    return { group, isLoading: false, error: null };
  } catch (error) {
    return { group: null, isLoading: false, error };
  }
};

export const assignCoordinatorToFormGroup = async (formGroupId: string, email: string) => {
  try {
    const res = await formGroupsControllerAssignCoordinatorToFormGroup({ formGroupId, email });
    return { result: res ?? null, isLoading: false, error: null };
  } catch (error) {
    return { result: null, isLoading: false, error };
  }
};

export const resetFormGroupCode = async (formGroupId: string) => {
  try {
    const res = await formGroupsControllerResetFormGroupCode({ formGroupId });
    return { result: res ?? null, isLoading: false, error: null };
  } catch (error) {
    return { result: null, isLoading: false, error };
  }
};

export const addFormToGroup = async (formNames: string[], groupId: string) => {
  console.log("API call to addFormToGroup with", { formNames, groupId });
  try {
    const res = await formGroupsControllerAddFormToGroup({ formNames, groupId });
    const result = (res as any)?.response ?? res ?? null;
    return { result, isLoading: false, error: null };
  } catch (error) {
    return { result: null, isLoading: false, error };
  }
};

export const removeFormsFromGroup = async (formNames: string[], groupId: string) => {
  try {
    const res = await formGroupsControllerRemoveFormFromGroup({ formNames, groupId });
    const result = (res as any)?.response ?? res ?? null;
    return { result, isLoading: false, error: null };
  } catch (error) {
    return { result: null, isLoading: false, error };
  }
};
