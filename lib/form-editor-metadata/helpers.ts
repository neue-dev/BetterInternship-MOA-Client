import type { IFormBlock } from "@betterinternship/core/forms";
import type { BlockGroup, ParentPatch } from "./types";

export const rewriteAutoCurrentDateFieldKeyForParty = (
  fieldKey: string,
  previousPartyId?: string | null,
  nextPartyId?: string | null
) => {
  if (!fieldKey.startsWith("auto.current-date:")) return fieldKey;
  if (fieldKey === "auto.current-date:default") return fieldKey;

  const suffix = fieldKey.slice("auto.current-date:".length);
  if (previousPartyId && suffix !== previousPartyId) return fieldKey;

  return `auto.current-date:${nextPartyId || "default"}`;
};

export const normalizeParentPatch = (updates: ParentPatch): ParentPatch => {
  const labelUpdate = updates.fieldLabel !== undefined ? updates.fieldLabel : updates.label;
  return {
    ...updates,
    ...(labelUpdate !== undefined ? { label: labelUpdate } : {}),
  };
};

export type FieldGroupIdentity = {
  fieldName?: string | null;
  partyId?: string | null;
  blockType?: string | null;
};

type PartyMatchMode = "exact" | "group";

export const getBlockSchema = (
  block?: Pick<IFormBlock, "field_schema" | "phantom_field_schema"> | null
) => block?.field_schema || block?.phantom_field_schema || undefined;

export const getBlockFieldName = (
  block?: Pick<IFormBlock, "field_schema" | "phantom_field_schema"> | null
) => getBlockSchema(block)?.field;

export const normalizeGroupPartyId = (partyId?: string | null) => partyId || "unknown";

const blockPartyMatches = (
  blockPartyId: string | undefined,
  partyId: string | null | undefined,
  mode: PartyMatchMode
) => {
  if (mode === "group") {
    return normalizeGroupPartyId(blockPartyId) === normalizeGroupPartyId(partyId);
  }
  return (blockPartyId || "") === (partyId || "");
};

export const blockMatchesFieldIdentity = (
  block: IFormBlock,
  identity: FieldGroupIdentity,
  options: { partyMatchMode?: PartyMatchMode; includeTextBlocks?: boolean } = {}
): boolean => {
  const { fieldName, partyId, blockType } = identity;
  if (!fieldName) return false;
  if (blockType && block.block_type !== blockType) return false;

  const textBlockFieldName =
    options.includeTextBlocks && (block.block_type === "header" || block.block_type === "paragraph")
      ? block.block_type
      : undefined;
  const blockFieldName = getBlockFieldName(block) || textBlockFieldName;
  if (blockFieldName !== fieldName) return false;

  return blockPartyMatches(block.signing_party_id, partyId, options.partyMatchMode || "exact");
};

export const blocksShareFieldIdentity = (block: IFormBlock, target: IFormBlock): boolean =>
  blockMatchesFieldIdentity(block, {
    fieldName: getBlockFieldName(target),
    partyId: target.signing_party_id,
    blockType: target.block_type,
  });

export const getBlockFieldGroupKey = (block: IFormBlock): string | null => {
  const fieldName = getBlockFieldName(block);
  if (!fieldName) return null;
  return `${fieldName}-${normalizeGroupPartyId(block.signing_party_id)}-${block.block_type}`;
};

export const blockMatchesGroup = (block: any, group: BlockGroup): boolean => {
  return blockMatchesFieldIdentity(
    block,
    { fieldName: group.fieldName, partyId: group.partyId },
    { partyMatchMode: "group", includeTextBlocks: true }
  );
};

export const applyPatchToFieldSchema = (schema: any, patch: ParentPatch) => ({
  ...schema,
  field: patch.fieldName !== undefined ? patch.fieldName : schema.field,
  label: patch.label !== undefined ? patch.label : schema.label,
  type: patch.type !== undefined ? patch.type : schema.type,
  source: patch.source !== undefined ? patch.source : schema.source,
  tooltip_label: patch.tooltip_label !== undefined ? patch.tooltip_label : schema.tooltip_label,
  shared: patch.shared !== undefined ? patch.shared : schema.shared,
  prefiller: patch.prefiller !== undefined ? patch.prefiller : schema.prefiller,
  validator: patch.validator !== undefined ? patch.validator : schema.validator,
  validator_ir: patch.validator_ir !== undefined ? patch.validator_ir : schema.validator_ir,
  align_h: patch.align_h !== undefined ? patch.align_h : schema.align_h,
  align_v: patch.align_v !== undefined ? patch.align_v : schema.align_v,
  size: patch.size !== undefined ? patch.size : schema.size,
  wrap: patch.wrap !== undefined ? patch.wrap : schema.wrap,
});

export const applyPatchToPhantomFieldSchema = (schema: any, patch: ParentPatch) => ({
  ...schema,
  field: patch.fieldName !== undefined ? patch.fieldName : schema.field,
  label: patch.label !== undefined ? patch.label : schema.label,
  type: patch.type !== undefined ? patch.type : schema.type,
  source: patch.source !== undefined ? patch.source : schema.source,
  tooltip_label: patch.tooltip_label !== undefined ? patch.tooltip_label : schema.tooltip_label,
  shared: patch.shared !== undefined ? patch.shared : schema.shared,
  prefiller: patch.prefiller !== undefined ? patch.prefiller : schema.prefiller,
  validator: patch.validator !== undefined ? patch.validator : schema.validator,
  validator_ir: patch.validator_ir !== undefined ? patch.validator_ir : schema.validator_ir,
});

export const ensureRequiredRuleOnFieldSchema = (schema: any) => {
  if (!schema) return schema;
  const validatorIr = schema.validator_ir;
  const rules = Array.isArray(validatorIr?.rules) ? validatorIr.rules : [];
  const hasRequired = rules.some((rule: any) => rule?.kind === "required");
  if (hasRequired) return schema;

  const baseType =
    validatorIr?.baseType ||
    (schema.type === "signature" ? "signature" : schema.type === "image" ? "image" : "text");

  return {
    ...schema,
    validator_ir: validatorIr
      ? { ...validatorIr, rules: [...rules, { kind: "required" }] }
      : { version: 0, baseType, rules: [{ kind: "required" }] },
  };
};

export const ensureRequiredRuleOnNewBlock = (block: IFormBlock): IFormBlock => {
  if (!block.field_schema) return block;
  return {
    ...block,
    field_schema: ensureRequiredRuleOnFieldSchema(block.field_schema),
  };
};

export const createUniqueFieldKey = (base: string) =>
  `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Default fields are created with "<preset_name>_<timestamp>_<rand>" keys.
// When duplicating such blocks, issue a new key so duplicates are not linked.
export const getUnlinkedDefaultDuplicateKey = (fieldKey: string): string | null => {
  const match = fieldKey.match(/^(.*)_\d{13}_[a-z0-9]{6}$/i);
  if (!match) return null;
  const base = match[1]?.trim();
  if (!base) return null;
  return createUniqueFieldKey(base);
};
