"use client";

import type { ValidatorConfig } from "@/lib/validator-engine";
import type { ValidatorBaseType } from "@/lib/validator-ir";
import {
  ValidatorDateInput,
  ValidatorFieldReferenceInput,
  ValidatorMessageButton,
  ValidatorNumberInput,
  ValidatorOptionsInput,
  ValidatorRow,
  ValidatorSelectInput,
  ValidatorStaticRow,
  ValidatorTimeInput,
} from "@/components/docs/form-editor/validation/ValidatorControls";
import {
  getArrayOptions,
  getDateRelativeValidator,
  getEnumOptions,
  getEnumMessage,
  getValidationMessageDefault,
  type ToggleValidatorId,
  getToggleValidatorViewModel,
  setArrayOptions,
  setDateRelativeValidator,
  setEnumMessage,
  setEnumOptions,
  setToggleValidatorMessage,
  setToggleValidatorEnabled,
  setToggleValidatorValue,
} from "@/components/docs/form-editor/validation/validator-state";

export type ValidationFieldOption = {
  id: string;
  name: string;
  partyName?: string;
  type?: string;
  validator?: string;
  validator_ir?: { baseType?: string } | null;
};

export type ValidationRuleId = ToggleValidatorId;

/**
 * Base-type scoped renderer for no-code validator controls.
 * All mutations flow through `validator-state` helpers so rule behavior is consistent
 * across all editor surfaces that use ValidationSection.
 */
export function ValidatorGroups({
  baseType,
  config,
  readOnly,
  fieldOptions,
  currentFieldId,
  allowedRuleIds,
  onConfigChange,
}: {
  baseType: ValidatorBaseType;
  config: ValidatorConfig;
  readOnly: boolean;
  fieldOptions: ValidationFieldOption[];
  currentFieldId?: string;
  allowedRuleIds?: ValidationRuleId[];
  onConfigChange: (next: ValidatorConfig) => void;
}) {
  const vm = getToggleValidatorViewModel(config);
  const relativeDate = getDateRelativeValidator(config);
  const relativeDateMessage = "message" in relativeDate ? relativeDate.message : undefined;
  const enumOptions = getEnumOptions(config);
  const enumMessage = getEnumMessage(config);
  const arrayOptions = getArrayOptions(config);
  const dateFieldOptions = fieldOptions.filter((option) => {
    if (currentFieldId && option.id === currentFieldId) return false;
    if (option.validator_ir?.baseType === "date") return true;
    if (option.type === "date") return true;
    const validatorValue = String(option.validator || "");
    return validatorValue.includes("z.coerce.date(") || validatorValue.includes("new Date(");
  });
  const hasDateFieldOptions = dateFieldOptions.length > 0;
  const defaultDateFieldId = dateFieldOptions[0]?.id ?? "";
  const baseFieldOffset =
    relativeDate.kind === "dateOnOrAfterField" || relativeDate.kind === "dateOnOrBeforeField"
      ? {
          offsetValue:
            Number.isFinite(Number(relativeDate.offsetValue)) &&
            Number(relativeDate.offsetValue) >= 0
              ? Math.floor(Number(relativeDate.offsetValue))
              : 0,
          offsetUnit:
            relativeDate.offsetUnit === "day" ||
            relativeDate.offsetUnit === "week" ||
            relativeDate.offsetUnit === "month"
              ? relativeDate.offsetUnit
              : ("day" as const),
          offsetDirection:
            relativeDate.offsetDirection === "before" || relativeDate.offsetDirection === "after"
              ? relativeDate.offsetDirection
              : ("after" as const),
        }
      : { offsetValue: 0, offsetUnit: "day" as const, offsetDirection: "after" as const };
  const dateOffsetUnitOptions = [
    { id: "day", name: "Days" },
    { id: "week", name: "Weeks" },
    { id: "month", name: "Months" },
  ];
  const dateOffsetDirectionOptions = [
    { id: "after", name: "After reference field" },
    { id: "before", name: "Before reference field" },
  ];
  type RelativeFieldKind = "dateOnOrAfterField" | "dateOnOrBeforeField";
  const isRelativeFieldRule =
    relativeDate.kind === "dateOnOrAfterField" || relativeDate.kind === "dateOnOrBeforeField";
  const activeRelativeFieldKind: RelativeFieldKind =
    relativeDate.kind === "dateOnOrBeforeField" ? "dateOnOrBeforeField" : "dateOnOrAfterField";
  const relativeComparatorOptions = [
    { id: "dateOnOrAfterField", name: "Be on or after" },
    { id: "dateOnOrBeforeField", name: "Be on or before" },
  ];
  const selectedReferenceFieldName =
    dateFieldOptions.find((option) => option.id === (isRelativeFieldRule ? relativeDate.field : ""))
      ?.name || "selected date field";
  const offsetUnitLabel =
    baseFieldOffset.offsetUnit === "day"
      ? baseFieldOffset.offsetValue === 1
        ? "day"
        : "days"
      : baseFieldOffset.offsetUnit === "week"
        ? baseFieldOffset.offsetValue === 1
          ? "week"
          : "weeks"
        : baseFieldOffset.offsetValue === 1
          ? "month"
          : "months";
  const relativeRuleSentence =
    activeRelativeFieldKind === "dateOnOrAfterField"
      ? `This date must be on or after ${baseFieldOffset.offsetValue} ${offsetUnitLabel} ${baseFieldOffset.offsetDirection} ${selectedReferenceFieldName}.`
      : `This date must be on or before ${baseFieldOffset.offsetValue} ${offsetUnitLabel} ${baseFieldOffset.offsetDirection} ${selectedReferenceFieldName}.`;
  const getRelativeReferenceLabel = (fieldId: string) =>
    dateFieldOptions.find((option) => option.id === fieldId)?.name || fieldId || "selected date field";
  const buildRelativeDateValidationMessage = (
    kind: RelativeFieldKind,
    fieldId: string,
    offset: { offsetValue: number; offsetUnit: "day" | "week" | "month"; offsetDirection: "before" | "after" }
  ) => {
    const referenceLabel = getRelativeReferenceLabel(fieldId);
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
    const comparator = kind === "dateOnOrAfterField" ? "on or after" : "on or before";
    return `Date must be ${comparator} ${offset.offsetValue} ${unit} ${offset.offsetDirection} ${referenceLabel}.`;
  };
  const getBusinessDaysValidationMessage = (businessDays: number) =>
    `Date must be at least ${businessDays} business day${businessDays === 1 ? "" : "s"} after today.`;
  const updateRelativeField = (
    kind: RelativeFieldKind,
    patch?: Partial<{
      field: string;
      offsetValue: number;
      offsetUnit: "day" | "week" | "month";
      offsetDirection: "before" | "after";
      message?: string;
    }>
  ) => {
    const current = relativeDate.kind === kind ? relativeDate : null;
    const nextField = patch?.field ?? current?.field ?? defaultDateFieldId;
    const nextOffsetValue =
      patch?.offsetValue !== undefined
        ? patch.offsetValue
        : (current?.offsetValue ?? baseFieldOffset.offsetValue);
    const nextOffsetUnit = patch?.offsetUnit ?? current?.offsetUnit ?? baseFieldOffset.offsetUnit;
    const nextOffsetDirection =
      patch?.offsetDirection ?? current?.offsetDirection ?? baseFieldOffset.offsetDirection;
    const normalizedOffsetValue =
      Number.isFinite(Number(nextOffsetValue)) && Number(nextOffsetValue) >= 0
        ? Math.floor(Number(nextOffsetValue))
        : 0;
    const normalizedOffsetUnit =
      nextOffsetUnit === "day" || nextOffsetUnit === "week" || nextOffsetUnit === "month"
        ? nextOffsetUnit
        : "day";
    const normalizedOffsetDirection =
      nextOffsetDirection === "before" || nextOffsetDirection === "after"
        ? nextOffsetDirection
        : "after";
    const previousMessage =
      current?.message ||
      buildRelativeDateValidationMessage(kind, nextField, baseFieldOffset);
    const previousDefault = buildRelativeDateValidationMessage(kind, current?.field ?? nextField, {
      offsetValue: current?.offsetValue ?? baseFieldOffset.offsetValue,
      offsetUnit: current?.offsetUnit ?? baseFieldOffset.offsetUnit,
      offsetDirection: current?.offsetDirection ?? baseFieldOffset.offsetDirection,
    });
    const nextDefault = buildRelativeDateValidationMessage(kind, nextField, {
      offsetValue: normalizedOffsetValue,
      offsetUnit: normalizedOffsetUnit,
      offsetDirection: normalizedOffsetDirection,
    });
    const nextMessage =
      patch?.message !== undefined
        ? patch.message
        : !previousMessage || previousMessage === previousDefault
          ? nextDefault
          : previousMessage;

    onConfigChange(
      setDateRelativeValidator(config, {
        kind,
        field: nextField,
        offsetValue: normalizedOffsetValue,
        offsetUnit: normalizedOffsetUnit,
        offsetDirection: normalizedOffsetDirection,
        message: nextMessage,
      })
    );
  };

  // Thin wrappers keep JSX concise and enforce immutable updates in one place.
  const toggle = (id: Parameters<typeof setToggleValidatorEnabled>[1], enabled: boolean) =>
    onConfigChange(setToggleValidatorEnabled(config, id, enabled));
  const setValue = (id: Parameters<typeof setToggleValidatorValue>[1], value: string | number) =>
    onConfigChange(setToggleValidatorValue(config, id, value));
  const setMessage = (id: ToggleValidatorId, message: string) =>
    onConfigChange(setToggleValidatorMessage(config, id, message));
  const renderMessageButton = (id: ToggleValidatorId, value?: string | number) => (
    <ValidatorMessageButton
      message={vm[id].message}
      defaultMessage={getValidationMessageDefault(id, value)}
      onChange={(next) => setMessage(id, next)}
      disabled={readOnly}
    />
  );
  const renderRelativeMessageButton = (defaultMessage: string) => (
    <ValidatorMessageButton
      message={relativeDateMessage}
      defaultMessage={defaultMessage}
      onChange={(next) => {
        if (relativeDate.kind !== "none") {
          onConfigChange(setDateRelativeValidator(config, { ...relativeDate, message: next }));
        }
      }}
      disabled={readOnly}
    />
  );
  const isAllowed = (id: ValidationRuleId) => !allowedRuleIds || allowedRuleIds.includes(id);
  const isRequiredOnly =
    Array.isArray(allowedRuleIds) &&
    allowedRuleIds.length === 1 &&
    allowedRuleIds[0] === "required";

  const renderRequiredRow = (label = "Required") => (
    <ValidatorRow
      label={label}
      enabled={vm.required.enabled}
      onToggle={(enabled) => toggle("required", enabled)}
      disabled={readOnly}
      messageControl={renderMessageButton("required")}
    />
  );
  const renderRelativeDateFieldRow = () => (
    <ValidatorRow
      label="Relative to another date field"
      description={
        !hasDateFieldOptions
          ? "No date fields available."
          : "Format: on or after/on or before [offset] [unit] after/before [field]."
      }
      enabled={isRelativeFieldRule}
      onToggle={(enabled) => {
        if (!enabled) {
          onConfigChange(setDateRelativeValidator(config, { kind: "none" }));
          return;
        }
        updateRelativeField(activeRelativeFieldKind);
      }}
      disabled={readOnly || !hasDateFieldOptions}
      messageControl={renderRelativeMessageButton(relativeRuleSentence)}
    >
      <ValidatorSelectInput
        value={activeRelativeFieldKind}
        options={relativeComparatorOptions}
        onChange={(next) => {
          if (next === "dateOnOrAfterField" || next === "dateOnOrBeforeField") {
            updateRelativeField(next);
          }
        }}
        placeholder="Rule"
        disabled={readOnly || !hasDateFieldOptions}
      />
      <ValidatorFieldReferenceInput
        value={isRelativeFieldRule ? relativeDate.field : ""}
        options={dateFieldOptions}
        onChange={(next) => updateRelativeField(activeRelativeFieldKind, { field: next })}
        disabled={readOnly || !hasDateFieldOptions}
      />
      <div className="grid grid-cols-3 gap-2">
        <ValidatorNumberInput
          value={baseFieldOffset.offsetValue}
          onChange={(next) =>
            updateRelativeField(activeRelativeFieldKind, {
              offsetValue:
                Number.isFinite(Number(next)) && Number(next) >= 0 ? Math.floor(Number(next)) : 0,
            })
          }
          placeholder="Offset"
          disabled={readOnly || !hasDateFieldOptions}
        />
        <ValidatorSelectInput
          value={baseFieldOffset.offsetUnit}
          options={dateOffsetUnitOptions}
          onChange={(next) =>
            updateRelativeField(activeRelativeFieldKind, {
              offsetUnit: next === "day" || next === "week" || next === "month" ? next : "day",
            })
          }
          placeholder="Time unit"
          disabled={readOnly || !hasDateFieldOptions}
        />
        <ValidatorSelectInput
          value={baseFieldOffset.offsetDirection}
          options={dateOffsetDirectionOptions}
          onChange={(next) =>
            updateRelativeField(activeRelativeFieldKind, {
              offsetDirection: next === "before" || next === "after" ? next : "after",
            })
          }
          placeholder="Before/after field"
          disabled={readOnly || !hasDateFieldOptions}
        />
      </div>
      {hasDateFieldOptions && (
        <p className="text-muted-foreground text-xs">{relativeRuleSentence}</p>
      )}
    </ValidatorRow>
  );

  if (isRequiredOnly) {
    return <div className="space-y-2">{renderRequiredRow()}</div>;
  }

  if (baseType === "email" || baseType === "phone" || baseType === "url") {
    return <div className="space-y-2">{renderRequiredRow()}</div>;
  }

  if (baseType === "text") {
    return (
      <div>
        {renderRequiredRow()}

        {isAllowed("minLength") && (
          <ValidatorRow
            label="Minimum characters"
            enabled={vm.minLength.enabled}
            onToggle={(enabled) => toggle("minLength", enabled)}
            disabled={readOnly}
            messageControl={renderMessageButton("minLength", vm.minLength.value)}
          >
            <ValidatorNumberInput
              value={vm.minLength.value as number | undefined}
              onChange={(next) => setValue("minLength", next)}
              placeholder="Minimum"
              disabled={readOnly}
            />
          </ValidatorRow>
        )}

        {isAllowed("maxLength") && (
          <ValidatorRow
            label="Maximum characters"
            enabled={vm.maxLength.enabled}
            onToggle={(enabled) => toggle("maxLength", enabled)}
            disabled={readOnly}
            messageControl={renderMessageButton("maxLength", vm.maxLength.value)}
          >
            <ValidatorNumberInput
              value={vm.maxLength.value as number | undefined}
              onChange={(next) => setValue("maxLength", next)}
              placeholder="Maximum"
              disabled={readOnly}
            />
          </ValidatorRow>
        )}

        {isAllowed("plainText") && (
          <ValidatorRow
            label="Plain text only"
            enabled={vm.plainText.enabled}
            onToggle={(enabled) => toggle("plainText", enabled)}
            disabled={readOnly}
          />
        )}
      </div>
    );
  }

  if (baseType === "textarea") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        {isAllowed("minLength") && (
          <ValidatorRow
            label="Minimum characters"
            enabled={vm.minLength.enabled}
            onToggle={(enabled) => toggle("minLength", enabled)}
            disabled={readOnly}
            messageControl={renderMessageButton("minLength", vm.minLength.value)}
          >
            <ValidatorNumberInput
              value={vm.minLength.value as number | undefined}
              onChange={(next) => setValue("minLength", next)}
              placeholder="Minimum"
              disabled={readOnly}
            />
          </ValidatorRow>
        )}
        {isAllowed("maxLength") && (
          <ValidatorRow
            label="Maximum characters"
            enabled={vm.maxLength.enabled}
            onToggle={(enabled) => toggle("maxLength", enabled)}
            disabled={readOnly}
            messageControl={renderMessageButton("maxLength", vm.maxLength.value)}
          >
            <ValidatorNumberInput
              value={vm.maxLength.value as number | undefined}
              onChange={(next) => setValue("maxLength", next)}
              placeholder="Maximum"
              disabled={readOnly}
            />
          </ValidatorRow>
        )}
        {isAllowed("plainText") && (
          <ValidatorRow
            label="Plain text only"
            enabled={vm.plainText.enabled}
            onToggle={(enabled) => toggle("plainText", enabled)}
            disabled={readOnly}
          />
        )}
      </div>
    );
  }

  if (baseType === "number") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        <ValidatorRow
          label="Minimum value"
          enabled={vm.min.enabled}
          onToggle={(enabled) => toggle("min", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("min", vm.min.value)}
        >
          <ValidatorNumberInput
            value={vm.min.value as number | undefined}
            onChange={(next) => setValue("min", next)}
            placeholder="Minimum value"
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="Maximum value"
          enabled={vm.max.enabled}
          onToggle={(enabled) => toggle("max", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("max", vm.max.value)}
        >
          <ValidatorNumberInput
            value={vm.max.value as number | undefined}
            onChange={(next) => setValue("max", next)}
            placeholder="Maximum value"
            disabled={readOnly}
          />
        </ValidatorRow>
      </div>
    );
  }

  if (baseType === "date") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        <ValidatorRow
          label="On or after date"
          enabled={vm.minDate.enabled}
          onToggle={(enabled) => toggle("minDate", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("minDate", vm.minDate.value)}
        >
          <ValidatorDateInput
            value={vm.minDate.value as string | undefined}
            onChange={(next) => setValue("minDate", next)}
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="On or before date"
          enabled={vm.maxDate.enabled}
          onToggle={(enabled) => toggle("maxDate", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("maxDate", vm.maxDate.value)}
        >
          <ValidatorDateInput
            value={vm.maxDate.value as string | undefined}
            onChange={(next) => setValue("maxDate", next)}
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="On or after today"
          enabled={relativeDate.kind === "dateOnOrAfterToday"}
          onToggle={(enabled) =>
            onConfigChange(
              setDateRelativeValidator(
                config,
                enabled
                  ? { kind: "dateOnOrAfterToday", message: relativeDateMessage || "Date must be on or after today." }
                  : { kind: "none" }
              )
            )
          }
          disabled={readOnly}
          messageControl={renderRelativeMessageButton("Date must be on or after today.")}
        />
        <ValidatorRow
          label="On or after business days from today"
          enabled={relativeDate.kind === "dateOnOrAfterBusinessDays"}
          onToggle={(enabled) =>
            onConfigChange(
              setDateRelativeValidator(
                config,
                enabled
                  ? {
                      kind: "dateOnOrAfterBusinessDays",
                      businessDays:
                        relativeDate.kind === "dateOnOrAfterBusinessDays"
                          ? relativeDate.businessDays
                          : 1,
                      message:
                        relativeDate.kind === "dateOnOrAfterBusinessDays"
                          ? relativeDate.message
                          : getBusinessDaysValidationMessage(1),
                    }
                  : { kind: "none" }
              )
            )
          }
          disabled={readOnly}
          messageControl={renderRelativeMessageButton(
            getBusinessDaysValidationMessage(
              relativeDate.kind === "dateOnOrAfterBusinessDays" ? relativeDate.businessDays : 1
            )
          )}
        >
          <ValidatorNumberInput
            value={
              relativeDate.kind === "dateOnOrAfterBusinessDays" ? relativeDate.businessDays : 1
            }
            onChange={(next) => {
              const parsed = Number(next);
              const businessDays = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
              const previousBusinessDays =
                relativeDate.kind === "dateOnOrAfterBusinessDays" ? relativeDate.businessDays : 1;
              const previousDefault = getBusinessDaysValidationMessage(previousBusinessDays);
              const currentMessage =
                relativeDate.kind === "dateOnOrAfterBusinessDays" ? relativeDate.message : undefined;
              onConfigChange(
                setDateRelativeValidator(config, {
                  kind: "dateOnOrAfterBusinessDays",
                  businessDays,
                  message:
                    !currentMessage || currentMessage === previousDefault
                      ? getBusinessDaysValidationMessage(businessDays)
                      : currentMessage,
                })
              );
            }}
            placeholder="Business days"
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="On or before today"
          enabled={relativeDate.kind === "dateOnOrBeforeToday"}
          onToggle={(enabled) =>
            onConfigChange(
              setDateRelativeValidator(
                config,
                enabled
                  ? { kind: "dateOnOrBeforeToday", message: relativeDateMessage || "Date must be on or before today." }
                  : { kind: "none" }
              )
            )
          }
          disabled={readOnly}
          messageControl={renderRelativeMessageButton("Date must be on or before today.")}
        />
        {renderRelativeDateFieldRow()}
      </div>
    );
  }

  if (baseType === "time") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        <ValidatorRow
          label="At or after time"
          enabled={vm.minTime.enabled}
          onToggle={(enabled) => toggle("minTime", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("minTime", vm.minTime.value)}
        >
          <ValidatorTimeInput
            value={vm.minTime.value as string | undefined}
            onChange={(next) => setValue("minTime", next)}
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="At or before time"
          enabled={vm.maxTime.enabled}
          onToggle={(enabled) => toggle("maxTime", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("maxTime", vm.maxTime.value)}
        >
          <ValidatorTimeInput
            value={vm.maxTime.value as string | undefined}
            onChange={(next) => setValue("maxTime", next)}
            disabled={readOnly}
          />
        </ValidatorRow>
      </div>
    );
  }

  if (baseType === "enum") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        <ValidatorStaticRow label="Dropdown options">
          <div className="flex justify-end">
            <ValidatorMessageButton
              message={enumMessage}
              defaultMessage="Please select an option"
              onChange={(next) => onConfigChange(setEnumMessage(config, next))}
              disabled={readOnly}
            />
          </div>
          <ValidatorOptionsInput
            values={enumOptions}
            onChange={(next) => onConfigChange(setEnumOptions(config, next))}
            disabled={readOnly}
          />
        </ValidatorStaticRow>
      </div>
    );
  }

  if (baseType === "array") {
    return (
      <div className="space-y-2">
        {renderRequiredRow()}
        <ValidatorStaticRow label="Multi-select options">
          <ValidatorOptionsInput
            values={arrayOptions}
            onChange={(next) => onConfigChange(setArrayOptions(config, next))}
            disabled={readOnly}
          />
        </ValidatorStaticRow>
        <ValidatorRow
          label="Minimum selected items"
          enabled={vm.minItems.enabled}
          onToggle={(enabled) => toggle("minItems", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("minItems", vm.minItems.value)}
        >
          <ValidatorNumberInput
            value={vm.minItems.value as number | undefined}
            onChange={(next) => setValue("minItems", next)}
            placeholder="Minimum items"
            disabled={readOnly}
          />
        </ValidatorRow>
        <ValidatorRow
          label="Maximum selected items"
          enabled={vm.maxItems.enabled}
          onToggle={(enabled) => toggle("maxItems", enabled)}
          disabled={readOnly}
          messageControl={renderMessageButton("maxItems", vm.maxItems.value)}
        >
          <ValidatorNumberInput
            value={vm.maxItems.value as number | undefined}
            onChange={(next) => setValue("maxItems", next)}
            placeholder="Maximum items"
            disabled={readOnly}
          />
        </ValidatorRow>
      </div>
    );
  }

  return <div className="space-y-2">{renderRequiredRow("This field is required")}</div>;
}
