import z from "zod";
import { createContext, useContext, useRef, useState } from "react";

import {
  ClientField,
  ClientPhantomField,
  FormErrors,
  FormValues,
} from "@betterinternship/core/forms";

export interface IFormFiller {
  getFinalValues: (autofillValues?: FormValues) => FormValues;
  setValue: (field: string, value: any) => void;
  setValues: (values: Record<string, any>) => void;
  initializeValues: (defaultValues: Record<string, any>) => void;
  validateField: (
    fieldKey: string,
    field: ClientField<any> | ClientPhantomField<any>,
    autofillValues?: FormValues,
    nextValue?: unknown
  ) => void;

  errors: FormErrors;
  validate: (
    fields: (ClientField<[any]> | ClientPhantomField<[any]>)[],
    autofillValues?: FormValues
  ) => FormErrors;
}

const FormFillerContext = createContext({} as IFormFiller);

export const useFormFiller = () => useContext(FormFillerContext);

export const FormFillerContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [, _setValues] = useState({});
  const [errors, _setErrors] = useState({});
  const valuesRef = useRef<FormValues>({});

  const getFinalValues = (additionalValues?: FormValues) => {
    return { ...additionalValues, ...valuesRef.current };
  };

  const setValue = (field: string, value: any) => {
    // Convert all values to strings for consistency
    const stringValue = value === null || value === undefined ? "" : String(value);
    const next = { ...valuesRef.current, [field]: stringValue };
    valuesRef.current = next;
    _setValues(next);
  };

  const setValues = (newValues: Record<string, any>) => {
    // Convert all values to strings for consistency
    const stringifiedValues = Object.entries(newValues).reduce(
      (acc, [key, val]) => {
        acc[key] = val === null || val === undefined ? "" : String(val);
        return acc;
      },
      {} as Record<string, string>
    );
    const next = { ...valuesRef.current, ...stringifiedValues };
    valuesRef.current = next;
    _setValues(next);
  };

  const initializeValues = (defaultValues: Record<string, any>) => {
    const prev = valuesRef.current;
    const stringifiedValues = Object.entries(defaultValues).reduce(
      (acc, [key, val]) => {
        const currentValue = prev[key];
        const hasExistingValue =
          currentValue !== null &&
          currentValue !== undefined &&
          String(currentValue).trim().length > 0;

        acc[key] = hasExistingValue
          ? String(currentValue)
          : val === null || val === undefined
            ? ""
            : String(val);
        return acc;
      },
      {} as Record<string, string>
    );

    const next = { ...prev, ...stringifiedValues };
    valuesRef.current = next;
    _setValues(next);
  };

  const validate = (
    fields: (ClientField<[any]> | ClientPhantomField<[any]>)[],
    autofillValues?: FormValues
  ) => {
    const errors: Record<string, string> = {};
    const finalValues = { ...(autofillValues ?? {}), ...valuesRef.current };

    type WithRadioGroupId = { radio_group_id?: string };
    const radioGroups = new Map<string, { fields: typeof fields; label: string }>();

    for (const field of fields) {
      const radioGroupId = (field as ClientField<any> & WithRadioGroupId).radio_group_id;
      if (radioGroupId) {
        if (!radioGroups.has(radioGroupId)) {
          radioGroups.set(radioGroupId, { fields: [], label: field.label ?? field.field });
        }
        radioGroups.get(radioGroupId)!.fields.push(field);
        continue;
      }
      const error = validateFieldHelper(field, valuesRef.current, autofillValues ?? {});
      if (error) errors[field.field] = error;
    }

    // Radio group passes if any option has a value; otherwise one error on the first field
    for (const [, group] of radioGroups) {
      const hasValue = group.fields.some((f) => !!finalValues[f.field]?.trim());
      if (!hasValue && group.fields[0]) {
        errors[group.fields[0].field] = `${group.label}: Required`;
      }
    }

    _setErrors(errors);
    return errors;
  };

  const validateField = (
    fieldKey: string,
    field: ClientField<any> | ClientPhantomField<any>,
    autofillValues?: FormValues,
    nextValue?: unknown
  ) => {
    const valuesForValidation =
      nextValue === undefined
        ? valuesRef.current
        : {
            ...valuesRef.current,
            [fieldKey]: nextValue === null || nextValue === undefined ? "" : String(nextValue),
          };
    const error = validateFieldHelper(field, valuesForValidation, autofillValues ?? {});
    if (error) {
      _setErrors((prev) => ({ ...prev, [fieldKey]: error }));
    } else {
      _setErrors((prev) => {
        const newErrors: Record<string, string> = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  return (
    <FormFillerContext.Provider
      value={{
        getFinalValues,
        setValue,
        setValues,
        initializeValues,
        validateField,

        validate,
        errors,
      }}
    >
      {children}
    </FormFillerContext.Provider>
  );
};

/**
 * Validates a specific field, given the specified values.
 *
 * @param field
 * @param values
 * @param autofillValues
 * @returns
 */
const validateFieldHelper = <T extends any[]>(
  field: ClientField<T>,
  values: FormValues,
  autofillValues: FormValues
) => {
  const finalValues = { ...autofillValues, ...values };
  // Only validate manual fields (already filtered for initiator in form renderer context)
  if (field.source !== "manual") {
    return;
  }

  const value = finalValues[field.field];
  const coerced = field.coerce(value);
  const result = field.validator?.safeParse(coerced);

  if (result?.error) {
    const errorString = z
      .treeifyError(result.error)
      .errors.map((e) => e.split(" ").slice(0).join(" "))
      .join("\n");
    return `${field.label}: ${errorString}`;
  }

  return null;
};
