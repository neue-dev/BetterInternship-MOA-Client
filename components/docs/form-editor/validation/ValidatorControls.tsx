"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormInput, FormTextarea, TimeInputNative } from "@/components/docs/forms/EditForm";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { MessageSquare } from "lucide-react";

/**
 * Shared presentational controls for validation rows.
 * These intentionally contain no rule logic and only render inputs/toggles.
 */
export function ValidatorRow({
  label,
  description,
  enabled,
  onToggle,
  disabled = false,
  messageControl,
  children,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  messageControl?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-slate-800">{label}</p>
          {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {enabled ? messageControl : null}
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
        </div>
      </div>
      {enabled && children ? <div className="mt-1.5 space-y-2">{children}</div> : null}
    </div>
  );
}

export function ValidatorStaticRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-slate-800">{label}</p>
        {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
      </div>
      {children ? <div className="mt-1.5 space-y-2">{children}</div> : null}
    </div>
  );
}

export function ValidatorNumberInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value?: number;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FormInput
      type="number"
      value={value ?? ""}
      setter={onChange}
      placeholder={placeholder}
      required={false}
      disabled={disabled}
      className="h-8 text-xs"
    />
  );
}

export function ValidatorTextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value?: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FormInput
      value={value || ""}
      setter={onChange}
      placeholder={placeholder}
      required={false}
      disabled={disabled}
      className="h-8 text-xs"
    />
  );
}

export function ValidatorMessageButton({
  message,
  defaultMessage,
  onChange,
  disabled,
}: {
  message?: string;
  defaultMessage: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const resolvedMessage = message?.trim() || defaultMessage;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-800"
          disabled={disabled}
          title="View validation message"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-700">Validation message</p>
          <p className="text-[11px] text-slate-500">Shown when this rule fails.</p>
        </div>
        <FormTextarea
          value={resolvedMessage}
          setter={onChange}
          required={false}
          disabled={disabled}
          className="min-h-20 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          disabled={disabled}
          onClick={() => onChange(defaultMessage)}
        >
          Reset to default
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function ValidatorSelectInput({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  value?: string;
  options: Array<{ id: string; name: string }>;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const resolvedValue = value && options.some((option) => option.id === value) ? value : "__none";

  return (
    <Select value={resolvedValue} onValueChange={(next) => onChange(next === "__none" ? "" : next)}>
      <SelectTrigger className="h-8 text-xs" disabled={disabled}>
        <SelectValue placeholder={placeholder || "Select"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">{placeholder || "Select"}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ValidatorDateInput({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormInput
      type="date"
      value={value || ""}
      setter={onChange}
      required={false}
      disabled={disabled}
      className="h-8 text-xs"
    />
  );
}

export function ValidatorTimeInput({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <TimeInputNative
      label=""
      value={value}
      onChange={(next) => onChange(next || "")}
      required={false}
      disabled={disabled}
      className="[&>input]:h-8 [&>input]:text-xs"
    />
  );
}

export function ValidatorOptionsInput({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <FormTextarea
      value={values.join("\n")}
      setter={(value) => {
        const next = value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
        onChange(next);
      }}
      required={false}
      disabled={disabled}
      placeholder="One option per line"
      className="min-h-20 text-xs"
    />
  );
}

export function ValidatorFieldReferenceInput({
  value,
  options,
  onChange,
  disabled,
}: {
  value?: string;
  options: Array<{ id: string; name: string; partyName?: string }>;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  if (!options.length) {
    return (
      <FormInput
        value={value || ""}
        setter={onChange}
        required={false}
        disabled={disabled}
        placeholder="Enter field name"
        className="h-8 text-xs"
      />
    );
  }

  return (
    <Select
      value={value || "__none"}
      onValueChange={(next) => onChange(next === "__none" ? "" : next)}
    >
      <SelectTrigger className="h-8 text-xs" disabled={disabled}>
        <SelectValue placeholder="Select field" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Select field</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.partyName ? `${option.name} (${option.partyName})` : option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
