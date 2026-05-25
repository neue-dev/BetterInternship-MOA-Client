/**
 * Date-relative validator state helpers for the form-editor UI.
 *
 * Isolated here because the date-relative rules are significantly more complex
 * than the simple toggle rules — they compile to/from `customRefine` code snippets
 * and carry their own offset/direction/field logic.
 */
import {
  createValidatorRule,
  type ValidatorConfig,
  type ValidatorRule,
} from "@/lib/validator-engine";
import type { ValidatorIRv0 } from "@/lib/validator-ir";

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

const DATE_REFINEMENT_DEFAULT_MESSAGE = "Invalid date";
const DATE_FIELD_OFFSET_DEFAULT = {
  offsetValue: 0,
  offsetUnit: "day" as DateOffsetUnit,
  offsetDirection: "after" as DateOffsetDirection,
};

export const getBusinessDaysMessage = (businessDays: number) =>
  `Date must be at least ${businessDays} business day${businessDays === 1 ? "" : "s"} after today.`;

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
