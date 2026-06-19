import { useSignatoryAccountActions } from "@/app/api/signatory.api";
import { useSignatoryProfile } from "@/app/docs/auth/provider/signatory.ctx";
import { useFormRendererContext } from "@/components/docs/forms/form-renderer.ctx";
import {
  parseSignatureImageValue,
  SIGNATURE_IMAGE_FIELD_PREFIX,
  type ClientField,
  type ClientPhantomField,
  type FormValues,
} from "@betterinternship/core/forms";
import { useCallback, useMemo } from "react";
import type { IFormField } from "@betterinternship/core/forms";

/**
 * Makes it easier to use the autofill, derived from profile data.
 * As simple as const autofillValues = useMyAutofill();
 *
 * @hook
 */
export const useMyAutofill = () => {
  const profile = useSignatoryProfile();
  const form = useFormRendererContext();
  const autofillValues = useMemo(() => {
    // Guard: return empty object if profile or autofill data doesn't exist
    if (!profile || !profile.autofill) return {};

    const internshipMoaFields = profile.autofill;

    // Destructure to isolate only shared fields or fields for that form
    const autofillValues = {
      ...(internshipMoaFields.base ?? {}),
      ...internshipMoaFields.shared,
      ...(internshipMoaFields[form.formName] ?? {}),
    };

    // Populate with prefillers as well
    for (const field of form.fields) {
      if (field.prefiller) {
        try {
          const s = field.prefiller({
            signatory: profile,
          });

          // ! Tentative fix for spaces, move to abstraction later on
          autofillValues[field.field] = typeof s === "string" ? s.trim().replace("  ", " ") : s;
        } catch (error) {
          // Silently skip prefiller if it fails (profile data not ready yet)
          continue;
        }
      }
    }

    return autofillValues;
  }, [profile, form.fields, form.formName]);

  return autofillValues;
};

/**
 * Util function for updating the autofill values of a profile.
 *
 * @hook
 */
export const useMyAutofillUpdate = () => {
  const { update } = useSignatoryAccountActions();

  return useCallback(
    async (
      formName: string,
      fields: (ClientField<[any]> | ClientPhantomField<[any]>)[],
      finalValues: FormValues
    ) => {
      const autofillToSave: Record<string, Record<string, string>> = {
        shared: {} as Record<string, string>,
      };

      // Save it per field or shared
      for (const field of fields) {
        if (field.shared) {
          autofillToSave.shared[field.field] = finalValues[field.field];
        } else {
          if (!autofillToSave[formName]) autofillToSave[formName] = {};
          autofillToSave[formName][field.field] = finalValues[field.field];
        }
      }

      const signatureImageKeys = Object.keys(finalValues).filter((key) =>
        key.startsWith(SIGNATURE_IMAGE_FIELD_PREFIX)
      );
      console.debug("[useMyAutofillUpdate] checking signature image keys", {
        signatureImageKeys,
        parsedResults: Object.fromEntries(
          signatureImageKeys.map((k) => [k, !!parseSignatureImageValue(finalValues[k])])
        ),
      });
      if (signatureImageKeys.length > 0) {
        const usedSignatureImage = signatureImageKeys.some((key) =>
          parseSignatureImageValue(finalValues[key])
        );
        autofillToSave.shared.__signature_image_enabled = usedSignatureImage ? "true" : "false";
      }
      console.debug("[useMyAutofillUpdate] autofillToSave", {
        autofillToSave,
        hasEnabled: "__signature_image_enabled" in (autofillToSave.shared ?? {}),
        enabledValue: autofillToSave.shared?.__signature_image_enabled,
      });

      // Save for future use
      await update.mutateAsync({
        autofill: autofillToSave,
      });
    },
    [update]
  );
};

/**
 * Computes missing manual fields for autosign validation.
 * Only checks fields with source='manual', ignoring auto/prefill/derived fields.
 *
 * @param requiredFields - Array of required fields to check
 * @param autofillValues - Current autofill values object
 * @returns Array of fields that are required but missing from autofill
 */
export const getMissingManualFields = (
  requiredFields: IFormField[],
  autofillValues: Record<string, any>
): IFormField[] => {
  return requiredFields.filter((field) => {
    // Only check fields with source='manual', ignore auto/prefill/derived
    if (field.source === "manual" && !autofillValues[field.field]) {
      return true;
    }
    return false;
  });
};
