/**
 * Validator state helpers for the form-editor UI (presentation layer).
 *
 * Purpose:
 * - Builds and mutates toggle-first `ValidatorConfig` state immutably.
 * - Maps date-relative UI presets to/from `customRefine` code snippets.
 * - Exposes view-model helpers consumed by validation controls in the editor.
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
import type { ValidatorBaseType, ValidatorIRv0 } from "@/lib/validator-ir";

type DateFieldRelativeRule = Extract<
  Extract<ValidatorIRv0, { baseType: "date" }>["rules"][number],
  { kind: "dateOnOrAfterField" | "dateOnOrBeforeField" }
>;
type DateOffsetUnit = NonNullable<DateFieldRelativeRule["offsetUnit"]>;
type DateOffsetDirection = NonNullable<DateFieldRelativeRule["offsetDirection"]>;

// IR-backed date presets represented through `customRefine` code snippets.
export type DateRelativeValidator =
  | { kind: "none" }
  | { kind: "dateOnOrAfterToday"; message?: string }
  | { kind: "dateOnOrBeforeToday"; message?: string }
  | { kind: "dateOnOrAfterBusinessDays"; businessDays: number; message?: string }
  | {
      kind: "dateOnOrAfterField";
      field: string;
      offsetValue?: number;
      offsetUnit?: DateOffsetUnit;
      offsetDirection?: DateOffsetDirection;
      message?: string;
    }
  | {
      kind: "dateOnOrBeforeField";
      field: string;
      offsetValue?: number;
      offsetUnit?: DateOffsetUnit;
      offsetDirection?: DateOffsetDirection;
      message?: string;
    };

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

const DATE_REFINEMENT_DEFAULT_MESSAGE = "Invalid date";
const DATE_FIELD_OFFSET_DEFAULT = {
  offsetValue: 0,
  offsetUnit: "day" as DateOffsetUnit,
  offsetDirection: "after" as DateOffsetDirection,
};

const getBusinessDaysMessage = (businessDays: number) =>
  `Date must be at least ${businessDays} business day${businessDays === 1 ? "" : "s"} after today.`;

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

function getDateRelativeFieldMessage(
  kind: "dateOnOrAfterField" | "dateOnOrBeforeField",
  field: string,
  offset: { offsetValue: number; offsetUnit: DateOffsetUnit; offsetDirection: DateOffsetDirection }
) {
  const unit =
    offset.offsetUnit === "day"
      ? offset.offsetValue === 1
        ? "day"
        : "days"
      : offset.offsetUnit === "week"
        ? offset.offsetValue === 1
          ? "week"
          : "weeks"
        : offset.offsetValue === 1
          ? "month"
          : "months";
  const comparison = kind === "dateOnOrAfterField" ? "on or after" : "on or before";
  return `Date must be ${comparison} ${offset.offsetValue} ${unit} ${offset.offsetDirection} ${field}.`;
}

function normalizeDateFieldOffset(relative: {
  offsetValue?: number;
  offsetUnit?: DateOffsetUnit;
  offsetDirection?: DateOffsetDirection;
}) {
  const parsedValue = Number(relative.offsetValue);
  const offsetValue = Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.floor(parsedValue) : 0;
  const offsetUnit =
    relative.offsetUnit === "day" || relative.offsetUnit === "week" || relative.offsetUnit === "month"
      ? relative.offsetUnit
      : DATE_FIELD_OFFSET_DEFAULT.offsetUnit;
  const offsetDirection =
    relative.offsetDirection === "before" || relative.offsetDirection === "after"
      ? relative.offsetDirection
      : DATE_FIELD_OFFSET_DEFAULT.offsetDirection;
  return { offsetValue, offsetUnit, offsetDirection };
}

function buildFieldRelativeRefineCode(
  comparator: ">=" | "<=",
  field: string,
  offset: { offsetValue: number; offsetUnit: DateOffsetUnit; offsetDirection: DateOffsetDirection }
) {
  const fieldLiteral = JSON.stringify(String(field || ""));
  return `const __relativeField__ = ${fieldLiteral};
const __offsetValue__ = ${offset.offsetValue};
const __offsetUnit__ = "${offset.offsetUnit}";
const __offsetDirection__ = "${offset.offsetDirection}";
const rawReference = params[__relativeField__];
if (rawReference == null || rawReference === "") return true;
const normalizedReference =
  typeof rawReference === "string" && /^-?\\d+$/.test(rawReference.trim())
    ? Number(rawReference)
    : rawReference;
const referenceDate = new Date(normalizedReference);
if (Number.isNaN(referenceDate.getTime())) return true;
const shiftedReference = new Date(referenceDate.getTime());
if (__offsetValue__ > 0) {
  const directionMultiplier = __offsetDirection__ === "before" ? -1 : 1;
  const magnitude = directionMultiplier * __offsetValue__;
  if (__offsetUnit__ === "day") shiftedReference.setDate(shiftedReference.getDate() + magnitude);
  else if (__offsetUnit__ === "week") shiftedReference.setDate(shiftedReference.getDate() + magnitude * 7);
  else shiftedReference.setMonth(shiftedReference.getMonth() + magnitude);
}
const candidate = new Date(date.getTime());
candidate.setHours(0, 0, 0, 0);
shiftedReference.setHours(0, 0, 0, 0);
return candidate.getTime() ${comparator} shiftedReference.getTime();`;
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

// Best-effort parser from existing customRefine code to supported date-relative presets.
function parseDateRelativeRule(rule: ValidatorRule | undefined): DateRelativeValidator {
  if (!rule || rule.type !== "customRefine") return { kind: "none" };
  const code = String(rule.params?.customCode || "");
  const message = String(rule.params?.message || DATE_REFINEMENT_DEFAULT_MESSAGE);
  if (!code) return { kind: "none" };

  const businessDaysMatch = code.match(/__businessDaysMin__\s*=\s*(\d+)/);
  if (businessDaysMatch) {
    const parsed = Number(businessDaysMatch[1]);
    return {
      kind: "dateOnOrAfterBusinessDays",
      businessDays: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1,
      message,
    };
  }

  if (code.includes("currentDateTimestamp")) {
    if (code.includes(">=") || code.includes(">")) return { kind: "dateOnOrAfterToday", message };
    if (code.includes("<=") || code.includes("<")) return { kind: "dateOnOrBeforeToday", message };
  }

  const fieldRef =
    code.match(/__relativeField__\s*=\s*["']([^"']+)["']/)?.[1] ||
    code.match(/params\[\s*["']([^"']+)["']\s*\]/)?.[1];
  if (!fieldRef) return { kind: "none" };
  const offsetValue = Number(code.match(/__offsetValue__\s*=\s*(-?\d+)/)?.[1] || 0);
  const rawOffsetUnit = code.match(/__offsetUnit__\s*=\s*["']([^"']+)["']/)?.[1];
  const rawOffsetDirection = code.match(/__offsetDirection__\s*=\s*["']([^"']+)["']/)?.[1];
  const offset = normalizeDateFieldOffset({
    offsetValue,
    offsetUnit:
      rawOffsetUnit === "day" || rawOffsetUnit === "week" || rawOffsetUnit === "month"
        ? (rawOffsetUnit as DateOffsetUnit)
        : undefined,
    offsetDirection: rawOffsetDirection === "before" || rawOffsetDirection === "after"
      ? (rawOffsetDirection as DateOffsetDirection)
      : undefined,
  });
  if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*>=/.test(code) || code.includes(">=")) {
    return { kind: "dateOnOrAfterField", field: fieldRef, ...offset, message };
  }
  if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*<=/.test(code) || code.includes("<=")) {
    return { kind: "dateOnOrBeforeField", field: fieldRef, ...offset, message };
  }

  return { kind: "none" };
}

// Compiler from date-relative preset -> validator-engine customRefine rule.
function buildDateRelativeRule(relative: DateRelativeValidator): ValidatorRule | null {
  switch (relative.kind) {
    case "dateOnOrAfterToday":
      return {
        ...createValidatorRule("customRefine"),
        params: {
          customCode: "return date.getTime() >= params.currentDateTimestamp;",
          message: relative.message || DATE_REFINEMENT_DEFAULT_MESSAGE,
          usesContext: true,
          refineType: "refine",
        },
      };
    case "dateOnOrBeforeToday":
      return {
        ...createValidatorRule("customRefine"),
        params: {
          customCode: "return date.getTime() <= params.currentDateTimestamp;",
          message: relative.message || DATE_REFINEMENT_DEFAULT_MESSAGE,
          usesContext: true,
          refineType: "refine",
        },
      };
    case "dateOnOrAfterBusinessDays": {
      const businessDays =
        Number.isFinite(relative.businessDays) && relative.businessDays > 0
          ? Math.floor(relative.businessDays)
          : 1;
      return {
        ...createValidatorRule("customRefine"),
        params: {
          customCode: `const __businessDaysMin__ = ${businessDays};
const today = new Date(params.currentDateTimestamp);
today.setHours(0, 0, 0, 0);
const candidate = new Date(date.getTime());
candidate.setHours(0, 0, 0, 0);
let businessDaysBetween = 0;
const cursor = new Date(today.getTime());
while (cursor.getTime() < candidate.getTime()) {
  cursor.setDate(cursor.getDate() + 1);
  if (cursor.getTime() >= candidate.getTime()) break;
  const day = cursor.getDay();
  if (day !== 0 && day !== 6) businessDaysBetween += 1;
}
const passed = businessDaysBetween >= __businessDaysMin__;
return passed;`,
          message: relative.message || getBusinessDaysMessage(businessDays),
          usesContext: true,
          refineType: "refine",
        },
      };
    }
    case "dateOnOrAfterField":
      if (!String(relative.field || "").trim()) return null;
      {
        const offset = normalizeDateFieldOffset(relative);
        return {
          ...createValidatorRule("customRefine"),
          params: {
            customCode: buildFieldRelativeRefineCode(">=", relative.field, offset),
            message:
              relative.message ||
              getDateRelativeFieldMessage("dateOnOrAfterField", relative.field, offset),
            usesContext: true,
            refineType: "refine",
          },
        };
      }
    case "dateOnOrBeforeField":
      if (!String(relative.field || "").trim()) return null;
      {
        const offset = normalizeDateFieldOffset(relative);
        return {
          ...createValidatorRule("customRefine"),
          params: {
            customCode: buildFieldRelativeRefineCode("<=", relative.field, offset),
            message:
              relative.message ||
              getDateRelativeFieldMessage("dateOnOrBeforeField", relative.field, offset),
            usesContext: true,
            refineType: "refine",
          },
        };
      }
    default:
      return null;
  }
}

// Extracts date-relative preset from config for date toggle UI rows.
export function getDateRelativeValidator(config: ValidatorConfig): DateRelativeValidator {
  return parseDateRelativeRule(config.rules.find((rule) => rule.type === "customRefine"));
}

// Enforces single date-relative customRefine rule by replacing existing customRefine entries.
export function setDateRelativeValidator(
  config: ValidatorConfig,
  relative: DateRelativeValidator
): ValidatorConfig {
  const nextRules = config.rules.filter((rule) => rule.type !== "customRefine");
  const relativeRule = buildDateRelativeRule(relative);
  return relativeRule ? { ...config, rules: [...nextRules, relativeRule] } : { ...config, rules: nextRules };
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

