import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { normalizeBlockForSave } from "@/lib/form-schema-normalizer";
import type { BlockGroup, FormViewUnit, ParentPatch } from "./types";
import {
  applyPatchToFieldSchema,
  applyPatchToPhantomFieldSchema,
  blockMatchesGroup,
  ensureRequiredRuleOnNewBlock,
  getUnlinkedDefaultDuplicateKey,
  normalizeParentPatch,
  rewriteAutoCurrentDateFieldKeyForParty,
} from "./helpers";

const withBlocks = (metadata: IFormMetadata, blocks: IFormBlock[]): IFormMetadata => ({
  ...metadata,
  schema: { ...metadata.schema, blocks },
});

const reindex = (blocks: IFormBlock[]): IFormBlock[] =>
  blocks.map((block, index) => ({ ...block, order: index }));

// Reassigns sequential order indices only when they have drifted out of sync.
export function normalizeBlockOrder(metadata: IFormMetadata): IFormMetadata {
  const blocks = metadata.schema.blocks || [];
  const needsNormalization = blocks.some((block, index) => (block.order ?? -1) !== index);
  if (!needsNormalization) return metadata;
  return withBlocks(metadata, reindex(blocks));
}

// Edits a single block, propagating shared (non-layout) field-schema changes to
// other blocks in the same field/party/type group. Rewrites auto-current-date
// keys when the party changes.
export function updateBlock(metadata: IFormMetadata, updatedBlock: IFormBlock): IFormMetadata {
  const existingBlock = metadata.schema.blocks.find((block) => block._id === updatedBlock._id);
  const normalizedUpdatedBlock =
    existingBlock &&
    existingBlock.signing_party_id !== updatedBlock.signing_party_id &&
    updatedBlock.field_schema?.field
      ? {
          ...updatedBlock,
          field_schema: {
            ...updatedBlock.field_schema,
            field: rewriteAutoCurrentDateFieldKeyForParty(
              updatedBlock.field_schema.field,
              existingBlock.signing_party_id,
              updatedBlock.signing_party_id
            ),
          },
        }
      : updatedBlock;

  const layoutKeys = new Set(["x", "y", "w", "h", "page", "align_h", "align_v", "size"]);
  const updatedSchema =
    normalizedUpdatedBlock.field_schema || normalizedUpdatedBlock.phantom_field_schema || undefined;
  const updatedFieldName = updatedSchema?.field;
  const updatedParty = normalizedUpdatedBlock.signing_party_id;

  const updatedBlocks = metadata.schema.blocks.map((block) => {
    if (block._id === normalizedUpdatedBlock._id) return normalizedUpdatedBlock;

    const targetSchema = block.field_schema || block.phantom_field_schema || undefined;
    const sameGroup =
      block.block_type === normalizedUpdatedBlock.block_type &&
      block.signing_party_id === updatedParty &&
      targetSchema?.field &&
      updatedFieldName &&
      targetSchema.field === updatedFieldName;

    if (!sameGroup) return block;

    if (block.field_schema && normalizedUpdatedBlock.field_schema) {
      const merged = { ...block.field_schema };
      Object.entries(normalizedUpdatedBlock.field_schema).forEach(([key, value]) => {
        if (!layoutKeys.has(key)) {
          (merged as any)[key] = value;
        }
      });
      return { ...block, field_schema: merged };
    }

    if (block.phantom_field_schema && normalizedUpdatedBlock.phantom_field_schema) {
      return {
        ...block,
        phantom_field_schema: { ...normalizedUpdatedBlock.phantom_field_schema },
      };
    }

    return block;
  });

  return withBlocks(metadata, updatedBlocks);
}

// Appends a single block, ensuring a required validator rule and a trailing order.
export function appendBlock(
  metadata: IFormMetadata,
  block: IFormBlock
): { metadata: IFormMetadata; block: IFormBlock } {
  const nextOrder = metadata.schema.blocks.length;
  const normalized = ensureRequiredRuleOnNewBlock(block);
  const blockToAppend: IFormBlock = { ...normalized, order: nextOrder };
  return {
    metadata: withBlocks(metadata, [...metadata.schema.blocks, blockToAppend]),
    block: blockToAppend,
  };
}

export function appendBlocks(
  metadata: IFormMetadata,
  blocks: IFormBlock[]
): { metadata: IFormMetadata; blocks: IFormBlock[] } {
  if (!blocks.length) return { metadata, blocks: [] };
  const startOrder = metadata.schema.blocks.length;
  const blocksToAppend = blocks.map((block, index) => ({
    ...ensureRequiredRuleOnNewBlock(block),
    order: startOrder + index,
  }));
  return {
    metadata: withBlocks(metadata, [...metadata.schema.blocks, ...blocksToAppend]),
    blocks: blocksToAppend,
  };
}

export function duplicateBlock(
  metadata: IFormMetadata,
  block: IFormBlock
): { metadata: IFormMetadata; block: IFormBlock } {
  const duplicateFieldKey =
    block.block_type === "form_field" && block.field_schema?.field
      ? getUnlinkedDefaultDuplicateKey(block.field_schema.field)
      : null;

  const newBlock: IFormBlock = {
    ...block,
    _id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...(duplicateFieldKey && block.field_schema
      ? { field_schema: { ...block.field_schema, field: duplicateFieldKey } }
      : {}),
  };
  return {
    metadata: withBlocks(metadata, reindex([...metadata.schema.blocks, newBlock])),
    block: newBlock,
  };
}

export function deleteBlock(metadata: IFormMetadata, blockId: string): IFormMetadata {
  return withBlocks(
    metadata,
    reindex(metadata.schema.blocks.filter((b) => b._id !== blockId))
  );
}

export function deleteGroupBlocks(
  metadata: IFormMetadata,
  fieldName: string,
  partyId: string
): IFormMetadata {
  const remaining = metadata.schema.blocks.filter((b) => {
    const isMatch =
      b.signing_party_id === partyId &&
      (b.field_schema?.field === fieldName ||
        b.phantom_field_schema?.field === fieldName ||
        ((b.block_type === "header" || b.block_type === "paragraph") &&
          fieldName === b.block_type));
    return !isMatch;
  });
  return withBlocks(metadata, reindex(remaining));
}

// Applies a patch to every block in a group; rewrites schemas and re-normalizes
// each touched block.
export function applyGroupPatch(
  metadata: IFormMetadata,
  group: BlockGroup,
  updates: ParentPatch
): IFormMetadata {
  const patch = normalizeParentPatch(updates);

  const updatedBlocks = metadata.schema.blocks.map((block: any) => {
    if (!blockMatchesGroup(block, group)) return block;

    const updated: IFormBlock = { ...block };
    const nextPartyId =
      patch.signing_party_id !== undefined ? patch.signing_party_id : block.signing_party_id;

    if (block.field_schema) {
      updated.field_schema = applyPatchToFieldSchema(block.field_schema, patch);
      const updatedFieldSchema = updated.field_schema;
      if (updatedFieldSchema) {
        updatedFieldSchema.field = rewriteAutoCurrentDateFieldKeyForParty(
          updatedFieldSchema.field,
          block.signing_party_id,
          nextPartyId
        );
      }
    }

    if (block.phantom_field_schema) {
      updated.phantom_field_schema = applyPatchToPhantomFieldSchema(block.phantom_field_schema, patch);
    }

    if (patch.block_type !== undefined) updated.block_type = patch.block_type;
    if (patch.signing_party_id !== undefined) updated.signing_party_id = patch.signing_party_id;
    if (patch.text_content !== undefined) updated.text_content = patch.text_content;

    return normalizeBlockForSave(updated);
  });

  return withBlocks(metadata, updatedBlocks);
}

// Propagates a label change to every block sharing a radio group id.
export function setRadioGroupLabel(
  metadata: IFormMetadata,
  radioGroupId: string,
  label: string
): IFormMetadata {
  const updatedBlocks = metadata.schema.blocks.map((b) => {
    if (b.block_type !== "form_field" || (b.field_schema as any)?.radio_group_id !== radioGroupId)
      return b;
    return { ...b, field_schema: { ...b.field_schema!, label } };
  });
  return withBlocks(metadata, updatedBlocks);
}

export function reorderBlocks(metadata: IFormMetadata, blocks: IFormBlock[]): IFormMetadata {
  return withBlocks(metadata, reindex(blocks));
}

export function moveBlock(
  metadata: IFormMetadata,
  blockId: string,
  direction: "up" | "down"
): IFormMetadata {
  const blocks = metadata.schema.blocks;
  const idx = blocks.findIndex((b) => b._id === blockId);
  if (idx === -1) return metadata;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) return metadata;

  const next = [...blocks];
  [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
  return withBlocks(metadata, reindex(next));
}

// Reorders blocks to match a target ordering of form-view units, leaving blocks
// outside the unit set in place.
export function reorderUnits(
  metadata: IFormMetadata,
  nextUnitIds: string[],
  formViewUnits: FormViewUnit[]
): IFormMetadata {
  if (nextUnitIds.length === 0) return metadata;

  const blocks = metadata.schema.blocks;
  const unitsMap = new Map(formViewUnits.map((unit) => [unit.id, unit]));
  const orderedUnits = nextUnitIds.map((id) => unitsMap.get(id)).filter(Boolean) as FormViewUnit[];
  if (orderedUnits.length === 0) return metadata;

  const orderedBlockIds = orderedUnits.flatMap((unit) => unit.blockIds);
  const idToBlock = new Map(blocks.map((block) => [block._id, block]));
  const replacementBlocks = orderedBlockIds
    .map((blockId) => idToBlock.get(blockId))
    .filter(Boolean) as IFormBlock[];
  const replacementSet = new Set(orderedBlockIds);

  let replacementIndex = 0;
  const reordered = blocks.map((block) => {
    if (!replacementSet.has(block._id)) return block;
    const replacement = replacementBlocks[replacementIndex];
    replacementIndex += 1;
    return replacement || block;
  });

  return withBlocks(metadata, reindex(reordered));
}

export function addPhantomBlock(
  metadata: IFormMetadata,
  type: "header" | "paragraph" | "phantom_field",
  partyId: string,
  customBlock?: IFormBlock
): { metadata: IFormMetadata; block: IFormBlock } {
  let newBlock: IFormBlock;

  if (type === "phantom_field" && customBlock) {
    newBlock = customBlock;
  } else {
    newBlock = { _id: `${type}-${Date.now()}` } as IFormBlock;
    newBlock.block_type = type;
    newBlock.signing_party_id = partyId;
    if (type === "header") newBlock.text_content = "New Header";
    else if (type === "paragraph") newBlock.text_content = "New Paragraph";
  }

  newBlock.order = metadata.schema.blocks.length;
  return {
    metadata: withBlocks(metadata, reindex([...metadata.schema.blocks, newBlock])),
    block: newBlock,
  };
}

export function addTextBlock(
  metadata: IFormMetadata,
  type: "header" | "paragraph",
  partyId: string
): { metadata: IFormMetadata; block: IFormBlock } {
  const newBlock: IFormBlock = {
    _id: `${type}-${Date.now()}`,
    block_type: type,
    signing_party_id: partyId,
    order: metadata.schema.blocks.length,
    text_content: type === "header" ? "New Header" : "New Paragraph",
  } as IFormBlock;

  return {
    metadata: withBlocks(metadata, [...metadata.schema.blocks, newBlock]),
    block: newBlock,
  };
}

export function addTextBlockAt(
  metadata: IFormMetadata,
  type: "header" | "paragraph",
  partyId: string,
  anchorUnitId: string,
  position: "before" | "after",
  formViewUnits: FormViewUnit[]
): { metadata: IFormMetadata; block: IFormBlock } {
  const blocks = metadata.schema.blocks;
  const newBlock: IFormBlock = {
    _id: `${type}-${Date.now()}`,
    block_type: type,
    signing_party_id: partyId,
    order: 0,
    text_content: type === "header" ? "New Header" : "New Paragraph",
  } as IFormBlock;

  let insertIndex = blocks.length;
  const anchor = formViewUnits.find((u) => u.id === anchorUnitId);
  if (anchor) {
    const anchorBlockIds = new Set(anchor.blockIds);
    const indices = blocks
      .map((b, idx) => (anchorBlockIds.has(b._id) ? idx : -1))
      .filter((idx) => idx !== -1);
    if (indices.length) {
      insertIndex = position === "before" ? indices[0] : indices[indices.length - 1] + 1;
    }
  }

  const next = [...blocks];
  next.splice(insertIndex, 0, newBlock);
  return {
    metadata: withBlocks(metadata, reindex(next)),
    block: newBlock,
  };
}
