import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  Calendar,
  ChevronsUpDown,
  Circle,
  CircleDot,
  Clock3,
  Hash,
  Link,
  List,
  Mail,
  Phone,
  Signature,
  Type,
} from "lucide-react";

export type PresetFieldIconKey =
  | "shortText"
  | "longText"
  | "number"
  | "signature"
  | "dropdown"
  | "multiselect"
  | "date"
  | "time"
  | "url"
  | "phone"
  | "email"
  | "radio";

// UI-only icon token map. Presets pass `iconKey` from package metadata.
const PRESET_FIELD_ICON_MAP: Record<PresetFieldIconKey, LucideIcon> = {
  shortText: Type,
  longText: AlignLeft,
  number: Hash,
  signature: Signature,
  dropdown: ChevronsUpDown,
  multiselect: List,
  date: Calendar,
  time: Clock3,
  url: Link,
  phone: Phone,
  email: Mail,
  radio: CircleDot,
};

const PRESET_NAME_TO_ICON_KEY: Record<string, PresetFieldIconKey> = {
  short_text: "shortText",
  name: "shortText",
  long_text: "longText",
  number: "number",
  signature: "signature",
  dropdown: "dropdown",
  multiselect: "multiselect",
  date: "date",
  time: "time",
  url: "url",
  phone_number: "phone",
  email: "email",
  radio: "radio",
};

const isPresetFieldIconKey = (value: string): value is PresetFieldIconKey =>
  Object.prototype.hasOwnProperty.call(PRESET_FIELD_ICON_MAP, value);

export function resolvePresetFieldIconKey(
  iconKey?: string | null,
  presetName?: string | null
): PresetFieldIconKey | null {
  if (iconKey && isPresetFieldIconKey(iconKey)) return iconKey;
  if (presetName) return PRESET_NAME_TO_ICON_KEY[presetName] || null;
  return null;
}

// Public helper used by BlocksPanel and preset picker; defaults to a neutral circle icon.
export function getPresetFieldIcon(iconKey?: string | null, presetName?: string | null): LucideIcon {
  const resolvedKey = resolvePresetFieldIconKey(iconKey, presetName);
  return resolvedKey ? PRESET_FIELD_ICON_MAP[resolvedKey] : Circle;
}
