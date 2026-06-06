"use client";

import { Textarea } from "@/components/ui/textarea";
import type { ValidatorIRv0 } from "@/lib/validator-ir";
import { useValidationModel } from "@/hooks/useValidationModel";
import {
  ValidatorGroups,
  type ValidationFieldOption,
  type ValidationRuleId,
} from "@/components/docs/form-editor/validation/ValidatorGroups";
import { ValidatorStateBanner } from "@/components/docs/form-editor/validation/ValidatorStateBanner";

export interface ValidationSectionProps {
  schemaType?: string;
  validator: string;
  validatorIr?: ValidatorIRv0 | null;
  fieldOptions?: ValidationFieldOption[];
  currentFieldId?: string;
  allowedRuleIds?: ValidationRuleId[];
  hideTitle?: boolean;
  onChange: (next: { validator: string; validator_ir: ValidatorIRv0 | null }) => void;
}

/**
 * Raw Zod editor used when users switch from no-code toggles to code mode.
 * Any change here is treated as source-of-truth Zod and clears `validator_ir`.
 */
export function ValidationRawEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='z.preprocess((v) => ((v ?? null) == null ? "" : (typeof v === "string" ? v.trim() : v)), z.string())'
        className="min-h-24 font-mono text-xs"
      />
    </div>
  );
}

/**
 * Top-level validation section shown in field editors.
 * Keeps host API stable while delegating mode/state behavior to `useValidationModel`.
 */
export function ValidationSection({
  schemaType,
  validator,
  validatorIr,
  fieldOptions = [],
  currentFieldId,
  allowedRuleIds,
  hideTitle = false,
  onChange,
}: ValidationSectionProps) {
  const {
    baseType,
    mode,
    setMode,
    config,
    importState,
    isReadOnlyLegacy,
    onConfigChange,
    onRawChange,
    replaceWithSimpleRules,
  } = useValidationModel({
    schemaType,
    validator,
    validatorIr,
    onChange,
  });
  const hasStateBanner = importState.status !== "exact";

  return (
    <div className={`relative space-y-1.5${hideTitle ? "" : " mt-6"}`}>
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Validation
          </h4>
          {!hasStateBanner ? (
            <button
              type="button"
              onClick={() => setMode((prev) => (prev === "raw" ? "simple" : "raw"))}
              className={`rounded px-1 text-[10px] leading-none ${
                mode === "raw"
                  ? "bg-slate-100 text-slate-700"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              }`}
              title={mode === "raw" ? "Back to no-code" : "Edit raw validator"}
            >
              {"<>"}
            </button>
          ) : null}
        </div>
      )}
      {hasStateBanner ? (
        <div className="flex items-center justify-between gap-2">
          <ValidatorStateBanner
            importState={importState}
            mode={mode}
            onSwitchRaw={() => setMode("raw")}
            onReplace={replaceWithSimpleRules}
          />
          <button
            type="button"
            onClick={() => setMode((prev) => (prev === "raw" ? "simple" : "raw"))}
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-none ${
              mode === "raw"
                ? "bg-slate-100 text-slate-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title={mode === "raw" ? "Back to no-code" : "Edit raw validator"}
          >
            {"<>"}
          </button>
        </div>
      ) : null}

      {mode === "simple" ? (
        <div>
          <ValidatorGroups
            baseType={baseType}
            config={config}
            readOnly={isReadOnlyLegacy}
            fieldOptions={fieldOptions}
            currentFieldId={currentFieldId}
            allowedRuleIds={allowedRuleIds}
            onConfigChange={onConfigChange}
          />
        </div>
      ) : (
        <ValidationRawEditor value={validator || ""} onChange={onRawChange} />
      )}
    </div>
  );
}
