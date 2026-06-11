/**
 * Validator IR module (domain/model layer).
 *
 * Purpose:
 * - Defines compatibility between field base types and validator rule types.
 * - Converts builder-engine config <-> persisted `validator_ir` shape.
 * - Handles import/export bridges (Zod code, legacy refine snippets, IR normalization).
 *
 * Scope:
 * - No editor UI state.
 * - Shared conversion logic used by save/load pipelines and runtime validators.
 */
import type { ValidatorConfig, ValidatorRule, ValidatorRuleType } from "@/lib/validator-engine";
import { validatorConfigToZodCode, zodCodeToValidatorConfig } from "@/lib/validator-engine";
import type {
  ValidatorBaseType as CoreValidatorBaseType,
  ValidatorIRv0 as CoreValidatorIRv0,
} from "@betterinternship/core/forms";

export type ValidatorBaseType = CoreValidatorBaseType;
export type ValidatorIRv0 = CoreValidatorIRv0;

type ImportStatus = "exact" | "partial" | "custom";
export type ValidatorIRImportResult = {
  status: ImportStatus;
  ir: ValidatorIRv0 | null;
  errors?: string[];
};

type DatePersistedRule = Extract<Extract<ValidatorIRv0, { baseType: "date" }>["rules"][number], { kind: string }>;
type DateFieldRelativeRule = Extract<
  DatePersistedRule,
  { kind: "dateOnOrAfterField" | "dateOnOrBeforeField" }
>;
type DateOffsetUnit = NonNullable<DateFieldRelativeRule["offsetUnit"]>;
type DateOffsetDirection = NonNullable<DateFieldRelativeRule["offsetDirection"]>;

const BASE_RULE_MAP: Record<ValidatorBaseType, ValidatorRuleType[]> = {
  text: [
    "required",
    "minLength",
    "maxLength",
    "email",
    "url",
    "regex",
    "plainText",
    "titleCase",
    "trim",
  ],
  number: ["required", "min", "max", "number"],
  date: ["required", "minDate", "maxDate", "customRefine", "date"],
  enum: ["required", "enum"],
  array: ["required", "array"],
  checkbox: ["required"],
  textarea: ["required", "minLength", "maxLength", "email", "url", "regex", "plainText"],
  time: ["required", "minTime", "maxTime"],
  email: ["required"],
  phone: ["required"],
  url: ["required"],
  signature: ["required"],
  image: ["required"],
  radio: ["required"],
};

const RULE_KIND_TO_ENGINE: Record<string, ValidatorRuleType> = {
  required: "required",
  minLength: "minLength",
  maxLength: "maxLength",
  email: "email",
  url: "url",
  regex: "regex",
  plainText: "plainText",
  titleCase: "titleCase",
  trim: "trim",
  min: "min",
  max: "max",
  enum: "enum",
  array: "array",
  minDate: "minDate",
  maxDate: "maxDate",
  minTime: "minTime",
  maxTime: "maxTime",
};

export function getAllowedRules(baseType: ValidatorBaseType): ValidatorRuleType[] {
  return BASE_RULE_MAP[baseType] || [];
}

export function isRuleCompatible(
  baseType: ValidatorBaseType,
  ruleType: ValidatorRuleType
): boolean {
  return getAllowedRules(baseType).includes(ruleType);
}

function inferBaseTypeFromZod(zodCode: string): ValidatorBaseType {
  const c = zodCode || "";
  if (c.includes('describe("radio")')) return "radio";
  if (c.includes('describe("multiselect")') || c.includes("z.array(")) return "array";
  if (c.includes("z.enum(") || c.includes('describe("dropdown")')) return "enum";
  if (c.includes('describe("checkbox")') || c.includes("z.boolean(")) return "checkbox";
  if (c.includes('describe("textarea")')) return "textarea";
  if (c.includes('describe("time")')) return "time";
  if (c.includes(".email(")) return "email";
  if (c.includes(".url(")) return "url";
  if (c.includes('describe("phone")') || c.includes("\\+?[0-9()\\-\\s]{7,20}")) return "phone";
  if (c.includes("z.coerce.date(") || c.includes("new Date(")) return "date";
  if (c.includes("z.number(")) return "number";
  return "text";
}

function normalizeDateIso(value: string): string {
  if (!value) return value;
  return value.includes("T") ? value.split("T")[0] : value;
}

type DatePresetRule =
  Extract<DatePersistedRule, { kind: "dateOnOrAfterToday" }>
  | Extract<DatePersistedRule, { kind: "dateOnOrBeforeToday" }>
  | Extract<DatePersistedRule, { kind: "dateOnOrAfterBusinessDays" }>
  | Extract<DatePersistedRule, { kind: "dateOnOrAfterField" }>
  | Extract<DatePersistedRule, { kind: "dateOnOrBeforeField" }>;

const DATE_PRESET_KINDS = [
  "dateOnOrAfterToday",
  "dateOnOrBeforeToday",
  "dateOnOrAfterBusinessDays",
  "dateOnOrAfterField",
  "dateOnOrBeforeField",
] as const;

type DatePresetKind = (typeof DATE_PRESET_KINDS)[number];

function isDatePresetKind(kind: string): kind is DatePresetKind {
  return (DATE_PRESET_KINDS as readonly string[]).includes(kind);
}

function buildBusinessDaysRefineCode(businessDays: number): string {
  return `const __businessDaysMin__ = ${businessDays};
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
return passed;`;
}

const DATE_FIELD_OFFSET_DEFAULT = {
  offsetValue: 0,
  offsetUnit: "day" as DateOffsetUnit,
  offsetDirection: "after" as DateOffsetDirection,
};

function normalizeDateFieldOffset(rule: {
  offsetValue?: number;
  offsetUnit?: DateOffsetUnit;
  offsetDirection?: DateOffsetDirection;
}) {
  const parsedValue = Number(rule.offsetValue);
  const offsetValue = Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.floor(parsedValue) : 0;
  const offsetUnit =
    rule.offsetUnit === "day" || rule.offsetUnit === "week" || rule.offsetUnit === "month"
      ? rule.offsetUnit
      : DATE_FIELD_OFFSET_DEFAULT.offsetUnit;
  const offsetDirection =
    rule.offsetDirection === "before" || rule.offsetDirection === "after"
      ? rule.offsetDirection
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

function parseDateCustomRefine(rule: ValidatorRule): DatePresetRule | null {
  const code = String(rule.params?.customCode || "");
  const message = String(rule.params?.message || "Invalid date");
  if (!code) return null;

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
    if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*>=/.test(code) || code.includes(">=")) return { kind: "dateOnOrAfterToday", message };
    if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*<=/.test(code) || code.includes("<=")) return { kind: "dateOnOrBeforeToday", message };
  }

  const fieldRefMatch =
    code.match(/__relativeField__\s*=\s*["']([^"']+)["']/) ||
    code.match(/params\[\s*["']([^"']+)["']\s*\]/);
  if (fieldRefMatch) {
    const field = fieldRefMatch[1];
    const offsetValue = Number(code.match(/__offsetValue__\s*=\s*(-?\d+)/)?.[1] || 0);
    const rawOffsetUnit = code.match(/__offsetUnit__\s*=\s*["']([^"']+)["']/)?.[1];
    const rawOffsetDirection = code.match(/__offsetDirection__\s*=\s*["']([^"']+)["']/)?.[1];
    const offset = normalizeDateFieldOffset({
      offsetValue,
      offsetUnit:
        rawOffsetUnit === "day" || rawOffsetUnit === "week" || rawOffsetUnit === "month"
          ? (rawOffsetUnit as DateOffsetUnit)
          : undefined,
      offsetDirection:
        rawOffsetDirection === "before" || rawOffsetDirection === "after"
          ? (rawOffsetDirection as DateOffsetDirection)
          : undefined,
    });
    if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*>=/.test(code) || code.includes(">="))
      return { kind: "dateOnOrAfterField", field, ...offset, message };
    if (/return\s+(?:candidate\.getTime\(\)|date\.getTime\(\))\s*<=/.test(code) || code.includes("<="))
      return { kind: "dateOnOrBeforeField", field, ...offset, message };
  }

  return null;
}

export function validatorConfigToPersistedIR(
  config: ValidatorConfig,
  baseType: ValidatorBaseType,
  meta?: Pick<ValidatorIRv0, "mode" | "importStatus" | "unmapped">
): ValidatorIRv0 {
  const rules: any[] = [];
  for (const rule of config.rules) {
    if (!isRuleCompatible(baseType, rule.type)) continue;
    if (rule.type === "customRefine" && baseType === "date") {
      const parsed = parseDateCustomRefine(rule);
      if (parsed) rules.push(parsed);
      continue;
    }
    switch (rule.type) {
      case "required":
        rules.push({ kind: "required", message: rule.params?.message as string | undefined });
        break;
      case "minLength":
      case "maxLength":
      case "min":
      case "max":
      case "minTime":
      case "maxTime":
        rules.push({
          kind: rule.type,
          value: rule.params?.value as number | string,
          message: rule.params?.message as string | undefined,
        });
        break;
      case "minDate":
      case "maxDate":
        rules.push({
          kind: rule.type,
          isoDate: normalizeDateIso(String(rule.params?.value || "")),
          message: rule.params?.message as string | undefined,
        });
        break;
      case "email":
      case "url":
      case "plainText":
      case "titleCase":
      case "trim":
        rules.push({ kind: rule.type, message: rule.params?.message as string | undefined });
        break;
      case "regex":
        rules.push({
          kind: "regex",
          pattern: String(rule.params?.value || ""),
          flags: String(rule.params?.flags || "") || undefined,
          message: rule.params?.message as string | undefined,
        });
        break;
      case "enum":
        rules.push({
          kind: "enum",
          options: (rule.params?.value as string[]) || [],
          message: rule.params?.message as string | undefined,
        });
        break;
      case "array":
        rules.push({
          kind: "array",
          options: (rule.params?.value as string[]) || [],
          minItems: rule.params?.minItems,
          maxItems: rule.params?.maxItems,
          minMessage: rule.params?.minMessage as string | undefined,
          maxMessage: rule.params?.maxMessage as string | undefined,
        });
        break;
    }
  }

  return {
    version: 0,
    baseType,
    rules: rules as any,
    mode: meta?.mode,
    importStatus: meta?.importStatus,
    unmapped: meta?.unmapped,
  };
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

function ruleToConfigRule(rule: any): ValidatorRule | null {
  const kind = rule?.kind as string;
  const mapped = RULE_KIND_TO_ENGINE[kind];
  if (!mapped) return null;
  const base: ValidatorRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: mapped,
    params: {},
  };
  switch (kind) {
    case "required":
      base.params = { message: rule.message };
      return base;
    case "minLength":
    case "maxLength":
    case "min":
    case "max":
    case "minTime":
    case "maxTime":
      base.params = { value: rule.value, message: rule.message };
      return base;
    case "minDate":
    case "maxDate":
      base.params = { value: rule.isoDate, message: rule.message };
      return base;
    case "email":
    case "url":
    case "plainText":
    case "titleCase":
    case "trim":
      base.params = { message: rule.message };
      return base;
    case "regex":
      base.params = { value: rule.pattern, flags: rule.flags, message: rule.message };
      return base;
    case "enum":
      base.params = { value: rule.options || [], message: rule.message };
      return base;
    case "array":
      base.params = {
        value: rule.options || [],
        minItems: rule.minItems,
        maxItems: rule.maxItems,
        minMessage: rule.minMessage,
        maxMessage: rule.maxMessage,
      };
      return base;
    default:
      return null;
  }
}

function datePresetRuleToConfigRule(rule: DatePresetRule): ValidatorRule | null {
  const message =
    typeof rule?.message === "string" && rule.message.trim().length > 0
      ? rule.message.trim()
      : undefined;
  switch (rule?.kind) {
    case "dateOnOrAfterToday":
      return {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "customRefine",
        params: {
          customCode: "return date.getTime() >= params.currentDateTimestamp;",
          message: message || "Date must be on or after today.",
          usesContext: true,
          refineType: "refine",
        },
      };
    case "dateOnOrBeforeToday":
      return {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "customRefine",
        params: {
          customCode: "return date.getTime() <= params.currentDateTimestamp;",
          message: message || "Date must be on or before today.",
          usesContext: true,
          refineType: "refine",
        },
      };
    case "dateOnOrAfterBusinessDays": {
      const businessDays =
        Number.isFinite(rule.businessDays) && rule.businessDays > 0
          ? Math.floor(rule.businessDays)
          : 1;
      return {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "customRefine",
        params: {
          customCode: buildBusinessDaysRefineCode(businessDays),
          message:
            message ||
            `Date must be at least ${businessDays} business day${businessDays === 1 ? "" : "s"} after today.`,
          usesContext: true,
          refineType: "refine",
        },
      };
    }
    case "dateOnOrAfterField":
      if (!String(rule.field || "").trim()) return null;
      {
        const offset = normalizeDateFieldOffset(rule);
        return {
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "customRefine",
          params: {
            customCode: buildFieldRelativeRefineCode(">=", rule.field, offset),
            message:
              message || getDateRelativeFieldMessage("dateOnOrAfterField", rule.field, offset),
            usesContext: true,
            refineType: "refine",
          },
        };
      }
    case "dateOnOrBeforeField":
      if (!String(rule.field || "").trim()) return null;
      {
        const offset = normalizeDateFieldOffset(rule);
        return {
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "customRefine",
          params: {
            customCode: buildFieldRelativeRefineCode("<=", rule.field, offset),
            message:
              message || getDateRelativeFieldMessage("dateOnOrBeforeField", rule.field, offset),
            usesContext: true,
            refineType: "refine",
          },
        };
      }
    default:
      return null;
  }
}

export function persistedIRToValidatorConfig(ir: ValidatorIRv0): ValidatorConfig {
  const rules: ValidatorRule[] = [];
  for (const rule of ir.rules as any[]) {
    if (isDatePresetKind(String(rule.kind || ""))) {
      const mapped = datePresetRuleToConfigRule(rule as DatePresetRule);
      if (mapped) rules.push(mapped);
      continue;
    }
    const mapped = ruleToConfigRule(rule);
    if (mapped) rules.push(mapped);
  }
  if (ir.baseType === "number" && !rules.some((r) => r.type === "number")) {
    rules.unshift({
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "number",
      params: {},
    });
  }
  if (ir.baseType === "date" && !rules.some((r) => r.type === "date")) {
    rules.unshift({
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "date",
      params: {},
    });
  }
  return { rules };
}

export function persistedIRToZod(ir: ValidatorIRv0): string {
  if (ir.baseType === "checkbox") {
    const message =
      ir.rules.find((r) => r.kind === "required")?.message || "This field is required.";
    return `z.preprocess((v) => !!v, z.boolean().refine((v) => v === true, { message: "${message}" }).describe("checkbox"))`;
  }

  // Keep time base validator stable when no-code mode recompiles from IR.
  if (ir.baseType === "time") {
    return 'z.string().describe("time")';
  }

  if (ir.baseType === "email") {
    const message =
      ir.rules.find((r) => r.kind === "required")?.message || "This field is required.";
    const validator = ir.rules.some((r) => r.kind === "required")
      ? `z.string().email().nonempty({ message: "${message}" })`
      : "z.string().email()";
    return `z.preprocess((v) => ((v ?? null) == null ? "" : (typeof v === "string" ? v.trim() : v)), ${validator})`;
  }

  if (ir.baseType === "url") {
    const message =
      ir.rules.find((r) => r.kind === "required")?.message || "This field is required.";
    const validator = ir.rules.some((r) => r.kind === "required")
      ? `z.string().url().nonempty({ message: "${message}" })`
      : "z.string().url()";
    return `z.preprocess((v) => ((v ?? null) == null ? "" : (typeof v === "string" ? v.trim() : v)), ${validator})`;
  }

  if (ir.baseType === "phone") {
    const message =
      ir.rules.find((r) => r.kind === "required")?.message || "This field is required.";
    const requiredMessage = JSON.stringify(message);
    const validator = ir.rules.some((r) => r.kind === "required")
      ? `z.string().regex(/^\\+?[0-9()\\-\\s]{7,20}$/, { message: "Please enter a valid phone number." }).nonempty({ message: ${requiredMessage} }).describe("phone")`
      : 'z.string().regex(/^\\+?[0-9()\\-\\s]{7,20}$/, { message: "Please enter a valid phone number." }).describe("phone")';
    return `z.preprocess((v) => ((v ?? null) == null ? "" : (typeof v === "string" ? v.trim() : v)), ${validator})`;
  }

  const config = persistedIRToValidatorConfig(ir);
  let zod = validatorConfigToZodCode(config);
  if (ir.baseType === "textarea" && !zod.includes('describe("textarea")')) {
    zod += '.describe("textarea")';
  }
  return zod;
}

export function zodToPersistedIR(
  zodCode: string,
  hintedBaseType?: ValidatorBaseType
): ValidatorIRImportResult {
  const raw = zodCode || "";
  if (!raw.trim()) {
    const baseType = hintedBaseType || "text";
    return {
      status: "exact",
      ir: {
        version: 0,
        baseType,
        rules: [],
        mode: "imported",
        importStatus: "exact",
      } as ValidatorIRv0,
    };
  }

  const baseType = hintedBaseType || inferBaseTypeFromZod(raw);
  const config = zodCodeToValidatorConfig(raw);
  const ir = validatorConfigToPersistedIR(config, baseType, {
    mode: "imported",
    importStatus: "exact",
  });

  // Detect date custom refine that parser could not map
  const hasUnmappedCustomRefine =
    baseType === "date" &&
    config.rules.some((r) => r.type === "customRefine") &&
    !ir.rules.some((r) => isDatePresetKind(String(r?.kind || "")));

  if (hasUnmappedCustomRefine) {
    return {
      status: "custom",
      ir: null,
      errors: ["Unsupported custom refine pattern for no-code mode."],
    };
  }

  // If unsupported rules were filtered out, classify as partial.
  const compatibleRulesCount = config.rules.filter(
    (r) =>
      isRuleCompatible(baseType, r.type) ||
      (baseType === "email" && r.type === "email") ||
      (baseType === "url" && r.type === "url") ||
      (baseType === "phone" && r.type === "regex")
  ).length;
  if (compatibleRulesCount !== config.rules.length) {
    return {
      status: "partial",
      ir: { ...ir, importStatus: "partial", unmapped: ["unsupported_rule_kind"] },
      errors: ["Some rule kinds are not supported for this base type."],
    };
  }

  return { status: "exact", ir };
}

export function validateValidatorIR(ir: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ir || typeof ir !== "object")
    return { ok: false, errors: ["validator_ir must be an object"] };
  const candidate = ir as any;
  if (candidate.version !== 0) errors.push("validator_ir.version must be 0");
  if (!candidate.baseType || !BASE_RULE_MAP[candidate.baseType as ValidatorBaseType]) {
    errors.push("validator_ir.baseType is invalid");
  }
  if (!Array.isArray(candidate.rules)) errors.push("validator_ir.rules must be an array");

  if (Array.isArray(candidate.rules) && BASE_RULE_MAP[candidate.baseType as ValidatorBaseType]) {
    const allowed = new Set(BASE_RULE_MAP[candidate.baseType as ValidatorBaseType]);
    for (let i = 0; i < candidate.rules.length; i++) {
      const rule = candidate.rules[i];
      const kind = String(rule?.kind || "");
      const mapped = RULE_KIND_TO_ENGINE[kind];
      if (!mapped && !isDatePresetKind(kind)) {
        errors.push(`rules[${i}] has unknown kind`);
        continue;
      }
      if (mapped && !allowed.has(mapped)) {
        errors.push(`rules[${i}] kind '${kind}' is not allowed for base '${candidate.baseType}'`);
      }
      if (
        (kind === "minTime" || kind === "maxTime") &&
        !/^\d{2}:\d{2}$/.test(String(rule.value || ""))
      ) {
        errors.push(`rules[${i}] ${kind}.value must be HH:mm`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
