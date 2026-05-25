/**
 * Validator state helpers for the form-editor UI (presentation layer).
 *
 * Purpose:
 * - Builds and mutates toggle-first `ValidatorConfig` state immutably.
 * - Exposes view-model helpers consumed by validation controls in the editor.
 *
 * Date-relative logic lives in validator-date-state.ts and is re-exported here
 * to keep this file focused on toggle/enum/array rule management.
 *
 * Scope:
 * - Editor interaction/state only.
 * - Does not own persisted IR shape/serialization policy.
 */
import {
  createValidatorRule,
  type ValidatorConfig,
  type ValidatorRule,
  type ValidatorRuleType,
} from "@/lib/validator-engine";
import type { ValidatorBaseType } from "@/lib/validator-ir";

export type {
  DateRelativeValidator,
} from "./validator-date-state";
export {
  getBusinessDaysMessage,
  getDateRelativeValidator,
  setDateRelativeValidator,
} from "./validator-date-state";

// ---------------------------------------------------------------------------
// Toggle validator types and view-model
// ---------------------------------------------------------------------------

export type ToggleValidatorId =
  | "required"
  | "minLength"
  | "maxLength"
  | "plainText"
  | "trim"
  | "min"
  | "max"
  | "minDate"
  | "maxDate"
  | "minTime"
  | "maxTime"
  | "minItems"
  | "maxItems";

export type ToggleValidatorState = {
  enabled: boolean;
  value?: string | number;
  message?: string;
};

// View model consumed by toggle-first UI rows.
export type ToggleValidatorViewModel = Record<ToggleValidatorId, ToggleValidatorState>;

function getDefaultToggleMessage(id: ToggleValidatorId, value?: string | number): string {
  const resolved = value === undefined || value === "" ? undefined : value;
  switch (id) {
    case "required":
      return "This field is required.";
    case "minLength":
      return `Please enter at least ${resolved ?? 0} characters.`;
    case "maxLength":
      return `Please enter no more than ${resolved ?? 0} characters.`;
    case "min":
      return `Please enter a value of at least ${resolved ?? 0}.`;
    case "max":
      return `Please enter a value no greater than ${resolved ?? 0}.`;
    case "minDate":
      return `Please choose a date on or after ${resolved ?? ""}.`;
    case "maxDate":
      return `Please choose a date on or before ${resolved ?? ""}.`;
    case "minTime":
      return `Please choose a time at or after ${resolved ?? "00:00"}.`;
    case "maxTime":
      return `Please choose a time at or before ${resolved ?? "23:59"}.`;
    case "minItems": {
      const count = Number(resolved ?? 1);
      return `Please select at least ${count} item${count === 1 ? "" : "s"}.`;
    }
    case "maxItems": {
      const count = Number(resolved ?? 5);
      return `Please select no more than ${count} item${count === 1 ? "" : "s"}.`;
    }
    default:
      return "Invalid value.";
  }
}

export function getValidationMessageDefault(id: ToggleValidatorId, value?: string | number) {
  return getDefaultToggleMessage(id, value);
}

function shouldRefreshGeneratedMessage(
  id: ToggleValidatorId,
  currentMessage: unknown,
  previousValue?: string | number
) {
  const current = toStringOrUndefined(currentMessage as string | number | string[] | undefined);
  if (!current) return true;
  return current === getDefaultToggleMessage(id, previousValue);
}

// Generic helpers for immutable rule CRUD against ValidatorConfig.
function getRule(config: ValidatorConfig, type: ValidatorRuleType): ValidatorRule | undefined {
  return config.rules.find((rule) => rule.type === type);
}

function removeRuleType(config: ValidatorConfig, type: ValidatorRuleType): ValidatorConfig {
  return { ...config, rules: config.rules.filter((rule) => rule.type !== type) };
}

function upsertRule(
  config: ValidatorConfig,
  type: ValidatorRuleType,
  nextParams?: ValidatorRule["params"]
): ValidatorConfig {
  const existing = getRule(config, type);
  if (!existing) {
    const created = createValidatorRule(type);
    return {
      ...config,
      rules: [...config.rules, { ...created, params: { ...created.params, ...nextParams } }],
    };
  }

  return {
    ...config,
    rules: config.rules.map((rule) =>
      rule.id === existing.id ? { ...rule, params: { ...rule.params, ...nextParams } } : rule
    ),
  };
}

function toNumberOrUndefined(value: string | number | string[] | undefined): number | undefined {
  if (Array.isArray(value)) return undefined;
  if (value === undefined || value === null || value === "") return undefined;
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function toStringOrUndefined(value: string | number | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined;
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

// Projects raw ValidatorConfig to the toggle UI state used by each base type section.
export function getToggleValidatorViewModel(config: ValidatorConfig): ToggleValidatorViewModel {
  const minItems = getRule(config, "array")?.params?.minItems;
  const maxItems = getRule(config, "array")?.params?.maxItems;
  const minItemsMessage = getRule(config, "array")?.params?.minMessage;
  const maxItemsMessage = getRule(config, "array")?.params?.maxMessage;

  return {
    required: {
      enabled: Boolean(getRule(config, "required")),
      message: toStringOrUndefined(getRule(config, "required")?.params?.message),
    },
    minLength: {
      enabled: Boolean(getRule(config, "minLength")),
      value: toNumberOrUndefined(getRule(config, "minLength")?.params?.value),
      message: toStringOrUndefined(getRule(config, "minLength")?.params?.message),
    },
    maxLength: {
      enabled: Boolean(getRule(config, "maxLength")),
      value: toNumberOrUndefined(getRule(config, "maxLength")?.params?.value),
      message: toStringOrUndefined(getRule(config, "maxLength")?.params?.message),
    },
    plainText: { enabled: Boolean(getRule(config, "plainText")) },
    trim: { enabled: Boolean(getRule(config, "trim")) },
    min: {
      enabled: Boolean(getRule(config, "min")),
      value: toNumberOrUndefined(getRule(config, "min")?.params?.value),
      message: toStringOrUndefined(getRule(config, "min")?.params?.message),
    },
    max: {
      enabled: Boolean(getRule(config, "max")),
      value: toNumberOrUndefined(getRule(config, "max")?.params?.value),
      message: toStringOrUndefined(getRule(config, "max")?.params?.message),
    },
    minDate: {
      enabled: Boolean(getRule(config, "minDate")),
      value: toStringOrUndefined(getRule(config, "minDate")?.params?.value),
      message: toStringOrUndefined(getRule(config, "minDate")?.params?.message),
    },
    maxDate: {
      enabled: Boolean(getRule(config, "maxDate")),
      value: toStringOrUndefined(getRule(config, "maxDate")?.params?.value),
      message: toStringOrUndefined(getRule(config, "maxDate")?.params?.message),
    },
    minTime: {
      enabled: Boolean(getRule(config, "minTime")),
      value: toStringOrUndefined(getRule(config, "minTime")?.params?.value),
      message: toStringOrUndefined(getRule(config, "minTime")?.params?.message),
    },
    maxTime: {
      enabled: Boolean(getRule(config, "maxTime")),
      value: toStringOrUndefined(getRule(config, "maxTime")?.params?.value),
      message: toStringOrUndefined(getRule(config, "maxTime")?.params?.message),
    },
    minItems: {
      enabled: typeof minItems === "number",
      value: minItems,
      message: toStringOrUndefined(minItemsMessage),
    },
    maxItems: {
      enabled: typeof maxItems === "number",
      value: maxItems,
      message: toStringOrUndefined(maxItemsMessage),
    },
  };
}

// Toggle handlers are centralized here so UI components stay stateless/dumb.
export function setToggleValidatorEnabled(
  config: ValidatorConfig,
  id: ToggleValidatorId,
  enabled: boolean
): ValidatorConfig {
  if (id === "minItems" || id === "maxItems") {
    const arrayRule = getRule(config, "array");
    const next = upsertRule(config, "array", {});
    const resolved = getRule(next, "array");
    if (!resolved) return next;
    const key = id === "minItems" ? "minItems" : "maxItems";
    const messageKey = id === "minItems" ? "minMessage" : "maxMessage";
    return upsertRule(next, "array", {
      ...resolved.params,
      [key]:
        enabled
          ? key === "minItems"
            ? (arrayRule?.params?.minItems ?? 1)
            : (arrayRule?.params?.maxItems ?? 5)
          : undefined,
      [messageKey]:
        enabled
          ? id === "minItems"
            ? (arrayRule?.params?.minMessage ?? getDefaultToggleMessage("minItems", arrayRule?.params?.minItems ?? 1))
            : (arrayRule?.params?.maxMessage ?? getDefaultToggleMessage("maxItems", arrayRule?.params?.maxItems ?? 5))
          : undefined,
    });
  }

  const mapped: ValidatorRuleType = id as ValidatorRuleType;
  if (enabled) {
    const existing = getRule(config, mapped);
    const baselineParams = existing?.params || createValidatorRule(mapped).params || {};
    return upsertRule(config, mapped, {
      ...baselineParams,
      message:
        baselineParams.message ??
        getDefaultToggleMessage(id, baselineParams.value as string | number | undefined),
    });
  }
  return removeRuleType(config, mapped);
}

export function setToggleValidatorValue(
  config: ValidatorConfig,
  id: ToggleValidatorId,
  value: string | number
): ValidatorConfig {
  if (id === "minItems" || id === "maxItems") {
    const next = upsertRule(config, "array", {});
    const arrayRule = getRule(next, "array");
    if (!arrayRule) return next;
    const key = id === "minItems" ? "minItems" : "maxItems";
    const messageKey = id === "minItems" ? "minMessage" : "maxMessage";
    const previousValue = id === "minItems" ? arrayRule.params?.minItems : arrayRule.params?.maxItems;
    const nextValue = toNumberOrUndefined(value) ?? undefined;
    const nextParams: ValidatorRule["params"] = {
      ...arrayRule.params,
      [key]: nextValue,
    };
    if (shouldRefreshGeneratedMessage(id, arrayRule.params?.[messageKey], previousValue as number | undefined)) {
      nextParams[messageKey] = getDefaultToggleMessage(id, nextValue);
    }
    return upsertRule(next, "array", {
      ...nextParams,
    });
  }

  const mapped: ValidatorRuleType = id as ValidatorRuleType;
  const existing = getRule(config, mapped);
  const nextParams = {
    ...(existing?.params || {}),
    value,
  };
  if (shouldRefreshGeneratedMessage(id, existing?.params?.message, existing?.params?.value as string | number | undefined)) {
    nextParams.message = getDefaultToggleMessage(id, value);
  }
  return upsertRule(config, mapped, {
    ...nextParams,
  });
}

export function setToggleValidatorMessage(
  config: ValidatorConfig,
  id: ToggleValidatorId,
  message: string
): ValidatorConfig {
  if (id === "minItems" || id === "maxItems") {
    const next = upsertRule(config, "array", {});
    const arrayRule = getRule(next, "array");
    if (!arrayRule) return next;
    const key = id === "minItems" ? "minMessage" : "maxMessage";
    return upsertRule(next, "array", {
      ...arrayRule.params,
      [key]: toStringOrUndefined(message),
    });
  }

  const mapped: ValidatorRuleType = id as ValidatorRuleType;
  return upsertRule(config, mapped, {
    ...(getRule(config, mapped)?.params || {}),
    message: toStringOrUndefined(message),
  });
}

export function getEnumOptions(config: ValidatorConfig): string[] {
  const value = getRule(config, "enum")?.params?.value;
  return Array.isArray(value) ? value.map(String) : [];
}

export function setEnumOptions(config: ValidatorConfig, options: string[]): ValidatorConfig {
  return upsertRule(config, "enum", {
    ...(getRule(config, "enum")?.params || {}),
    value: options,
  });
}

export function getEnumMessage(config: ValidatorConfig): string {
  return String(getRule(config, "enum")?.params?.message || "");
}

export function setEnumMessage(config: ValidatorConfig, message: string): ValidatorConfig {
  return upsertRule(config, "enum", {
    ...(getRule(config, "enum")?.params || {}),
    message: toStringOrUndefined(message),
  });
}

export function getArrayOptions(config: ValidatorConfig): string[] {
  const value = getRule(config, "array")?.params?.value;
  return Array.isArray(value) ? value.map(String) : [];
}

export function setArrayOptions(config: ValidatorConfig, options: string[]): ValidatorConfig {
  const next = upsertRule(config, "array", {});
  return upsertRule(next, "array", {
    ...(getRule(next, "array")?.params || {}),
    value: options,
  });
}

// Safety guard for host UIs that need to branch by base type.
export function supportsRuleInBase(baseType: ValidatorBaseType, id: ToggleValidatorId): boolean {
  if (baseType === "text") {
    return ["required", "minLength", "maxLength", "plainText"].includes(id);
  }
  if (baseType === "textarea") {
    return ["required", "minLength", "maxLength", "plainText"].includes(id);
  }
  if (baseType === "number") {
    return ["required", "min", "max"].includes(id);
  }
  if (baseType === "date") {
    return ["required", "minDate", "maxDate"].includes(id);
  }
  if (baseType === "time") {
    return ["required", "minTime", "maxTime"].includes(id);
  }
  if (baseType === "enum") {
    return ["required"].includes(id);
  }
  if (baseType === "array") {
    return ["required", "minItems", "maxItems"].includes(id);
  }
  if (baseType === "checkbox" || baseType === "signature" || baseType === "image") {
    return ["required"].includes(id);
  }
  if (baseType === "email" || baseType === "phone" || baseType === "url") {
    return ["required"].includes(id);
  }
  return false;
}

