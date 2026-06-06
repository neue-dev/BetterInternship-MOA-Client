"use client";

import { Lock, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDefaultValueModel } from "@/hooks/useDefaultValueModel";
import { buildFieldRefPrefiller, buildManualPrefiller } from "@/lib/default-value-builder";
import type { CompactDefaultValueState } from "@/lib/default-value-builder";

export interface DefaultValueFieldOption {
  id: string;
  name: string;
  partyName?: string;
  type?: string;
  validator?: string;
  validator_ir?: { baseType?: string } | null;
}

interface DefaultValueSimplePickerProps {
  parsed: CompactDefaultValueState;
  open: boolean;
  setOpen: (open: boolean) => void;
  manualValue: string;
  setManualValue: (value: string) => void;
  fieldOptions: DefaultValueFieldOption[];
  isLocked: boolean;
  onChange: (prefiller: string) => void;
  simpleMode?: "full" | "manual-only";
}

export function DefaultValueSimplePicker({
  parsed,
  open,
  setOpen,
  manualValue,
  setManualValue,
  fieldOptions,
  isLocked,
  onChange,
  simpleMode = "full",
}: DefaultValueSimplePickerProps) {
  if (simpleMode === "manual-only") {
    return (
      <Input
        value={manualValue}
        onChange={(e) => setManualValue(e.target.value)}
        onBlur={() => onChange(buildManualPrefiller(manualValue))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(buildManualPrefiller(manualValue));
          }
        }}
        placeholder="Type value"
        disabled={isLocked}
        className="h-8 text-sm"
      />
    );
  }

  const triggerText =
    parsed.kind === "field"
      ? fieldOptions.find((option) => option.id === parsed.fieldRef)?.name || parsed.fieldRef
      : parsed.kind === "manual"
        ? parsed.manualValue || "Manual"
        : parsed.kind === "custom"
          ? "Custom"
          : "Select";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLocked}
          className="flex h-8 w-full items-center justify-between rounded-[0.33em] border border-slate-300 bg-white px-2.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate">{triggerText}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        onWheelCapture={(e) => e.stopPropagation()}
        className="z-[1200] w-[var(--radix-dropdown-menu-trigger-width)] rounded-[0.33em] p-2"
      >
        <div
          className="max-h-44 space-y-1 overflow-auto pr-0.5"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {fieldOptions.map((field) => (
            <DropdownMenuItem
              key={field.id}
              onClick={() => {
                onChange(buildFieldRefPrefiller(field.id));
                setOpen(false);
              }}
              className="text-sm"
            >
              <div className="flex flex-col">
                <span>{field.name}</span>
                {field.partyName && (
                  <span className="text-[10px] text-slate-500">{field.partyName}</span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="my-2" />
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Manual value</p>
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onBlur={() => onChange(buildManualPrefiller(manualValue))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange(buildManualPrefiller(manualValue));
                setOpen(false);
              }
            }}
            placeholder="Type value"
            className="h-8 text-sm"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DefaultValueRawEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  isLocked?: boolean;
}

export function DefaultValueRawEditor({
  value,
  onChange,
  error,
  isLocked = false,
}: DefaultValueRawEditorProps) {
  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='() => "Sample Value"'
        disabled={isLocked}
        className="min-h-24 font-mono text-xs"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface DefaultValueSectionProps {
  title?: string;
  hideTitle?: boolean;
  source: string;
  value: string;
  fieldOptions: DefaultValueFieldOption[];
  onChange: (value: string) => void;
  simpleMode?: "full" | "manual-only";
}

export function DefaultValueSection({
  title = "Default value",
  hideTitle = false,
  source,
  value,
  fieldOptions,
  onChange,
  simpleMode = "full",
}: DefaultValueSectionProps) {
  const {
    mode,
    setMode,
    open,
    setOpen,
    parsed,
    manualValue,
    setManualValue,
    advancedValidation,
    isLocked,
  } = useDefaultValueModel({
    source,
    prefiller: value || "",
  });

  return (
    <div className="space-y-2">
      {!hideTitle && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {title}
          </h4>
          <div className="flex items-center gap-2">
            {parsed.kind === "custom" && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                Custom
              </span>
            )}
            <button
              type="button"
              onClick={() => setMode((prev) => (prev === "raw" ? "simple" : "raw"))}
              className="rounded-[0.33em] px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              {mode === "raw" ? "Back" : "<>"}
            </button>
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>
        </div>
      )}

      {mode === "simple" ? (
        <DefaultValueSimplePicker
          parsed={parsed}
          open={open}
          setOpen={setOpen}
          manualValue={manualValue}
          setManualValue={setManualValue}
          fieldOptions={fieldOptions}
          isLocked={isLocked}
          onChange={onChange}
          simpleMode={simpleMode}
        />
      ) : (
        <DefaultValueRawEditor
          value={value || ""}
          onChange={onChange}
          isLocked={isLocked}
          error={advancedValidation.valid ? undefined : advancedValidation.message}
        />
      )}
    </div>
  );
}
