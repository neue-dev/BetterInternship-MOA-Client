import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { normalizeBlockForSave } from "@/lib/form-schema-normalizer";
import type { BlockGroup } from "./types";
import {
  ensureRequiredRuleOnNewBlock,
  getUnlinkedDefaultDuplicateKey,
  rewriteAutoCurrentDateFieldKeyForParty,
  normalizeParentPatch,
  blockMatchesGroup,
  applyPatchToFieldSchema,
  applyPatchToPhantomFieldSchema,
} from "./helpers";

export function useBlockMutations({
  formMetadata,
  blocks,
  updateBlocks,
  blockGroups,
  setBlockGroups,
  setSelectedBlockId,
  setSelectedBlockGroup,
  setPendingMissingFieldDraft,
}: {
  formMetadata: IFormMetadata | null;
  blocks: IFormBlock[];
  updateBlocks: (blocks: IFormBlock[]) => void;
  blockGroups: Record<string, BlockGroup>;
  setBlockGroups: Dispatch<SetStateAction<Record<string, BlockGroup>>>;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  setSelectedBlockGroup: Dispatch<SetStateAction<BlockGroup | null>>;
  setPendingMissingFieldDraft: Dispatch<SetStateAction<IFormBlock | null>>;
}) {
  const handleBlockUpdate = useCallback(
    (updatedBlock: IFormBlock) => {
      if (!formMetadata) return;
      const existingBlock = formMetadata.schema.blocks.find(
        (block) => block._id === updatedBlock._id
      );
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
        normalizedUpdatedBlock.field_schema ||
        normalizedUpdatedBlock.phantom_field_schema ||
        undefined;
      const updatedFieldName = updatedSchema?.field;
      const updatedParty = normalizedUpdatedBlock.signing_party_id;

      const updatedBlocks = formMetadata.schema.blocks.map((block) => {
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

      updateBlocks(updatedBlocks);
    },
    [formMetadata, updateBlocks]
  );

  const handleBlockCreate = useCallback(
    (newBlock: IFormBlock) => {
      if (!formMetadata) return;
      const nextOrder = formMetadata.schema.blocks.length;
      const normalizedNewBlock = ensureRequiredRuleOnNewBlock(newBlock);
      const blockToAppend: IFormBlock = { ...normalizedNewBlock, order: nextOrder };

      updateBlocks([...formMetadata.schema.blocks, blockToAppend]);
      setSelectedBlockId(blockToAppend._id);
      setSelectedBlockGroup(null);
      setPendingMissingFieldDraft(null);
    },
    [formMetadata, updateBlocks, setSelectedBlockId, setSelectedBlockGroup, setPendingMissingFieldDraft]
  );

  const handleBlocksCreate = useCallback(
    (newBlocks: IFormBlock[]) => {
      if (!formMetadata || !newBlocks.length) return;

      const startOrder = formMetadata.schema.blocks.length;
      const blocksToAppend = newBlocks.map((block, index) => ({
        ...ensureRequiredRuleOnNewBlock(block),
        order: startOrder + index,
      }));

      updateBlocks([...formMetadata.schema.blocks, ...blocksToAppend]);
      setSelectedBlockId(blocksToAppend[0]?._id || null);
      setSelectedBlockGroup(null);
      setPendingMissingFieldDraft(null);
    },
    [formMetadata, updateBlocks, setSelectedBlockId, setSelectedBlockGroup, setPendingMissingFieldDraft]
  );

  const handleDuplicateBlock = useCallback(
    (block: IFormBlock) => {
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
      updateBlocks([...blocks, newBlock]);
    },
    [blocks, updateBlocks]
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      updateBlocks(blocks.filter((b) => b._id !== blockId));
    },
    [blocks, updateBlocks]
  );

  const handleDeleteGroupBlocks = useCallback(
    (fieldName: string, partyId: string) => {
      const remainingBlocks = blocks.filter((b) => {
        const fieldSchema = b.field_schema;
        const phantomSchema = b.phantom_field_schema;

        const isMatch =
          b.signing_party_id === partyId &&
          (fieldSchema?.field === fieldName ||
            phantomSchema?.field === fieldName ||
            ((b.block_type === "header" || b.block_type === "paragraph") &&
              fieldName === b.block_type));

        return !isMatch;
      });
      updateBlocks(remainingBlocks);
    },
    [blocks, updateBlocks]
  );

  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  const handleParentUpdate = useCallback(
    (blockId: string, updates: any) => {
      if (!formMetadata) return;

      const group = blockGroups[blockId];
      if (!group) return;

      const patch = normalizeParentPatch(updates);

      const updatedBlocks = formMetadata.schema.blocks.map((block: any) => {
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
          updated.phantom_field_schema = applyPatchToPhantomFieldSchema(
            block.phantom_field_schema,
            patch
          );
        }

        if (patch.block_type !== undefined) updated.block_type = patch.block_type;
        if (patch.signing_party_id !== undefined) updated.signing_party_id = patch.signing_party_id;
        if (patch.text_content !== undefined) updated.text_content = patch.text_content;

        return normalizeBlockForSave(updated);
      });

      updateBlocks(updatedBlocks);

      const newPartyId =
        patch.signing_party_id !== undefined ? patch.signing_party_id : group.partyId;

      if (patch.signing_party_id !== undefined || patch.block_type !== undefined) {
        setBlockGroups((prev) => ({
          ...prev,
          [blockId]: { ...group, partyId: newPartyId },
        }));

        setSelectedBlockGroup((prev) => {
          if (!prev) return prev;
          const matches = prev.fieldName === group.fieldName && prev.partyId === group.partyId;
          if (matches) return { ...prev, partyId: newPartyId };
          return prev;
        });
      }
    },
    [formMetadata, updateBlocks, blockGroups, setBlockGroups, setSelectedBlockGroup]
  );
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

  return {
    handleBlockUpdate,
    handleBlockCreate,
    handleBlocksCreate,
    handleDuplicateBlock,
    handleDeleteBlock,
    handleDeleteGroupBlocks,
    handleParentUpdate,
  };
}
