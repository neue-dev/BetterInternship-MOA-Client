"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
import { IFormBlock } from "@betterinternship/core/forms";
import { normalizeBlockForSave } from "@/lib/form-schema-normalizer";
import { useFormEditor } from "./form-editor.context";

export interface BlockGroup {
  id: string;
  fieldName: string;
  partyId: string;
  blockIds: string[]; // ordered list of block IDs in this group
}

export type EditorViewMode = "pdf" | "form";

export interface FormViewUnit {
  id: string;
  kind: "field" | "header" | "paragraph";
  label: string;
  partyId: string;
  blockIds: string[];
  primaryBlockId: string;
}

type ParentPatch = Record<string, any>;

const rewriteAutoCurrentDateFieldKeyForParty = (
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

const normalizeParentPatch = (updates: ParentPatch): ParentPatch => {
  const labelUpdate = updates.fieldLabel !== undefined ? updates.fieldLabel : updates.label;
  return {
    ...updates,
    ...(labelUpdate !== undefined ? { label: labelUpdate } : {}),
  };
};

const blockMatchesGroup = (block: any, group: BlockGroup): boolean => {
  const schema = block.field_schema || block.phantom_field_schema;
  return (
    (schema?.field === group.fieldName || block.block_type === group.fieldName) &&
    (block.signing_party_id === group.partyId ||
      (block.signing_party_id === "" && group.partyId === "unknown") ||
      (block.signing_party_id === "unknown" && group.partyId === ""))
  );
};

const applyPatchToFieldSchema = (schema: any, patch: ParentPatch) => ({
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

const applyPatchToPhantomFieldSchema = (schema: any, patch: ParentPatch) => ({
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

const ensureRequiredRuleOnFieldSchema = (schema: any) => {
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

const ensureRequiredRuleOnNewBlock = (block: IFormBlock): IFormBlock => {
  if (!block.field_schema) return block;
  return {
    ...block,
    field_schema: ensureRequiredRuleOnFieldSchema(block.field_schema),
  };
};

const createUniqueFieldKey = (base: string) =>
  `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Default fields are created with "<preset_name>_<timestamp>_<rand>" keys.
// When duplicating such blocks, issue a new key so duplicates are not linked.
const getUnlinkedDefaultDuplicateKey = (fieldKey: string): string | null => {
  const match = fieldKey.match(/^(.*)_\d{13}_[a-z0-9]{6}$/i);
  if (!match) return null;
  const base = match[1]?.trim();
  if (!base) return null;
  return createUniqueFieldKey(base);
};

interface FormEditorTabContextType {
  // Selection state
  selectedPartyId: string | null;
  setSelectedPartyId: (partyId: string | null) => void;

  selectedBlockId: string | null;
  setSelectedBlockId: (blockId: string | null) => void;

  selectedFieldId: string | null;
  setSelectedFieldId: (fieldId: string | null) => void;
  pendingMissingFieldDraft: IFormBlock | null;
  setPendingMissingFieldDraft: (block: IFormBlock | null) => void;

  // Normalized state for blocks and groups
  blockGroupsOrder: string[]; // ordered list of block group IDs
  blockGroups: Record<string, BlockGroup>;
  blocksMap: Record<string, IFormBlock>;

  // Currently selected group (for UI focus/editing)
  selectedBlockGroup: BlockGroup | null;
  setSelectedBlockGroup: (group: BlockGroup | null) => void;

  // Blocks array for backward compatibility
  blocks: IFormBlock[];

  // UI state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  preferredPlacementPage: number;
  setPreferredPlacementPage: (page: number) => void;
  editorViewMode: EditorViewMode;
  setEditorViewMode: (mode: EditorViewMode) => void;
  formViewUnits: FormViewUnit[];

  // Handlers
  handleBlockSelect: (blockId: string) => void;
  handleParentGroupSelect: (blockId: string, group: BlockGroup | null) => void;
  handleBlockUpdate: (updatedBlock: IFormBlock) => void;
  handleBlockCreate: (block: IFormBlock) => void;
  handleBlocksCreate: (blocks: IFormBlock[]) => void;
  handleFieldSelectFromPdf: (fieldId: string) => void;
  handleParentUpdate: (blockId: string, updates: any) => void;

  // Block management
  handleDuplicateBlock: (block: IFormBlock) => void;
  handleDeleteBlock: (blockId: string) => void;
  handleDeleteGroupBlocks: (fieldName: string, partyId: string) => void;
  handleReorderBlocks: (blocks: IFormBlock[]) => void;
  handleReorderBlock: (blockId: string, direction: "up" | "down") => void;
  handleAddPhantomBlock: (
    type: "header" | "paragraph" | "phantom_field",
    selectedPartyId: string,
    customBlock?: IFormBlock
  ) => void;
  handleSelectFormViewUnit: (unitId: string) => void;
  handleReorderFormViewUnits: (nextUnitIds: string[]) => void;
  handleAddFormTextBlock: (type: "header" | "paragraph") => void;
  confirmPendingMissingFieldDraft: () => void;
  cancelPendingMissingFieldDraft: () => void;
}

const FormEditorTabContext = createContext<FormEditorTabContextType | undefined>(undefined);

export function FormEditorTabProvider({ children }: { children: ReactNode }) {
  const { formMetadata, updateBlocks } = useFormEditor();

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(
    formMetadata?.signing_parties?.[0]?._id || null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pendingMissingFieldDraft, setPendingMissingFieldDraft] = useState<IFormBlock | null>(null);
  const [blockGroupsOrder, setBlockGroupsOrder] = useState<string[]>([]);
  const [blockGroups, setBlockGroups] = useState<Record<string, BlockGroup>>({});
  const [selectedBlockGroup, setSelectedBlockGroup] = useState<BlockGroup | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [preferredPlacementPage, setPreferredPlacementPage] = useState(1);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>("pdf");

  // Expose blocks as array derived from blocksMap, or directly from formMetadata
  const blocks = useMemo(() => {
    return formMetadata?.schema.blocks || [];
  }, [formMetadata]);

  useEffect(() => {
    if (!formMetadata || blocks.length === 0) return;

    const needsOrderNormalization = blocks.some((block, index) => (block.order ?? -1) !== index);
    if (!needsOrderNormalization) return;

    const normalizedBlocks = blocks.map((block, index) => ({
      ...block,
      order: index,
    }));

    updateBlocks(normalizedBlocks);
  }, [blocks, formMetadata, updateBlocks]);

  // Initialize normalized state - create blocksMap
  const _blocksMap = useMemo(() => {
    const map: Record<string, IFormBlock> = {};
    blocks.forEach((block) => {
      map[block._id] = block;
    });
    return map;
  }, [blocks]);

  const activePartyId = useMemo(() => {
    return selectedPartyId || formMetadata?.signing_parties?.[0]?._id || "";
  }, [formMetadata?.signing_parties, selectedPartyId]);

  const formViewUnits = useMemo<FormViewUnit[]>(() => {
    if (!activePartyId) return [];

    const units: FormViewUnit[] = [];
    const fieldUnits = new Map<string, FormViewUnit>();
    const radioGroupUnits = new Map<string, FormViewUnit>();

    blocks.forEach((block) => {
      if ((block.signing_party_id || "") !== activePartyId) return;

      if (block.block_type === "header" || block.block_type === "paragraph") {
        units.push({
          id: block._id,
          kind: block.block_type,
          label:
            (block.text_content || "").trim() ||
            (block.block_type === "header" ? "Header" : "Paragraph"),
          partyId: activePartyId,
          blockIds: [block._id],
          primaryBlockId: block._id,
        });
        return;
      }

      const schema = block.field_schema || block.phantom_field_schema;
      const fieldName = schema?.field;
      if (!fieldName) return;

      const radioGroupId = block.field_schema?.radio_group_id;
      if (radioGroupId) {
        const existing = radioGroupUnits.get(radioGroupId);
        if (existing) {
          existing.blockIds.push(block._id);
          return;
        }
        const unit: FormViewUnit = {
          id: `radio-group-${radioGroupId}`,
          kind: "field",
          label: schema?.label ?? fieldName,
          partyId: activePartyId,
          blockIds: [block._id],
          primaryBlockId: block._id,
        };
        radioGroupUnits.set(radioGroupId, unit);
        units.push(unit);
        return;
      }

      const groupId = `${fieldName}-${activePartyId}-${block.block_type}`;
      const existing = fieldUnits.get(groupId);
      if (existing) {
        existing.blockIds.push(block._id);
        return;
      }

      const unit: FormViewUnit = {
        id: groupId,
        kind: "field",
        label: schema?.label ?? fieldName,
        partyId: activePartyId,
        blockIds: [block._id],
        primaryBlockId: block._id,
      };
      fieldUnits.set(groupId, unit);
      units.push(unit);
    });

    return units;
  }, [activePartyId, blocks]);

  // Initialize normalized state from blocks
  useEffect(() => {
    const newBlockGroups: Record<string, BlockGroup> = {};
    const newOrder: string[] = [];
    const seenGroupIds = new Set<string>();

    blocks.forEach((block) => {
      const blockType = block.block_type;

      // For headers and paragraphs, use block._id as the group ID
      if (blockType === "header" || blockType === "paragraph") {
        const groupId = block._id;
        if (!seenGroupIds.has(groupId)) {
          newBlockGroups[groupId] = {
            id: groupId,
            fieldName: blockType,
            partyId: block.signing_party_id || "unknown",
            blockIds: [block._id],
          };
          newOrder.push(groupId);
          seenGroupIds.add(groupId);
        }
        return;
      }

      // For phantom_field and form_phantom_field, get field from phantom_field_schema
      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      let schema: any = block.field_schema;
      if (!schema && (blockType === "phantom_field" || blockType === "form_phantom_field")) {
        schema = block.phantom_field_schema;
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      if (!schema) return;

      const fieldName: string = (schema.field || "Unnamed") as string;
      const partyId = block.signing_party_id || "unknown";
      // Include blockType in groupId to prevent different block types with the same field name from being grouped together
      const groupId = `${fieldName}-${partyId}-${blockType}`;

      if (!seenGroupIds.has(groupId)) {
        newBlockGroups[groupId] = {
          id: groupId,
          fieldName,
          partyId,
          blockIds: [block._id],
        };
        newOrder.push(groupId);
        seenGroupIds.add(groupId);
      } else {
        // Add block to existing group
        newBlockGroups[groupId].blockIds.push(block._id);
      }
    });

    setBlockGroupsOrder(newOrder);
    setBlockGroups(newBlockGroups);
  }, [blocks]);

  const findGroupByBlockId = useCallback(
    (blockId: string): BlockGroup | null => {
      const groupId = blockGroupsOrder.find((id) => blockGroups[id]?.blockIds?.includes(blockId));
      return groupId ? blockGroups[groupId] : null;
    },
    [blockGroups, blockGroupsOrder]
  );

  const handleBlockSelect = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId || null);
      // Find the actual group containing this block
      const group = findGroupByBlockId(blockId);
      setSelectedBlockGroup(group);
    },
    [findGroupByBlockId]
  );

  const handleParentGroupSelect = useCallback((blockId: string, group: BlockGroup | null) => {
    if (group) {
      const groupId = group.id;

      // Add to blockGroups if not exists
      setBlockGroups((prev) => {
        if (prev[groupId]) return prev;
        return {
          ...prev,
          [groupId]: group,
        };
      });

      // Add to blockGroupsOrder if not exists
      setBlockGroupsOrder((prev) => {
        if (prev.includes(groupId)) return prev;
        return [...prev, groupId];
      });

      setSelectedBlockGroup(group);
    }
  }, []);

  const handleBlockUpdate = useCallback(
    (updatedBlock: IFormBlock) => {
      if (!formMetadata) return;
      const existingBlock = formMetadata.schema.blocks.find((block) => block._id === updatedBlock._id);
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

        // Sync non-layout keys across same-field instances; keep PDF placement keys per block.
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
          return { ...block, phantom_field_schema: { ...normalizedUpdatedBlock.phantom_field_schema } };
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
      const blockToAppend: IFormBlock = {
        ...normalizedNewBlock,
        order: nextOrder,
      };

      updateBlocks([...formMetadata.schema.blocks, blockToAppend]);
      setSelectedBlockId(blockToAppend._id);
      setSelectedBlockGroup(null);
      setPendingMissingFieldDraft(null);
    },
    [formMetadata, updateBlocks]
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
    [formMetadata, updateBlocks]
  );

  const handleFieldSelectFromPdf = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedBlockId(fieldId);
    setSelectedBlockGroup(null);
    if (!pendingMissingFieldDraft || pendingMissingFieldDraft._id !== fieldId) {
      setPendingMissingFieldDraft(null);
    }
  }, [pendingMissingFieldDraft]);

  const confirmPendingMissingFieldDraft = useCallback(() => {
    if (!pendingMissingFieldDraft) return;
    if (!formMetadata) return;

    const nextOrder = formMetadata.schema.blocks.length;
    const normalizedDraft = ensureRequiredRuleOnNewBlock(pendingMissingFieldDraft);
    updateBlocks([
      ...formMetadata.schema.blocks,
      {
        ...normalizedDraft,
        order: nextOrder,
      },
    ]);
    setPendingMissingFieldDraft(null);
    setSelectedBlockId(normalizedDraft._id);
    setSelectedBlockGroup(null);
  }, [formMetadata, pendingMissingFieldDraft, updateBlocks]);

  const cancelPendingMissingFieldDraft = useCallback(() => {
    if (!pendingMissingFieldDraft) return;
    setPendingMissingFieldDraft(null);
    if (selectedBlockId === pendingMissingFieldDraft._id) {
      setSelectedBlockId(null);
    }
  }, [pendingMissingFieldDraft, selectedBlockId]);

  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  const handleParentUpdate = useCallback(
    (blockId: string, updates: any) => {
      if (!formMetadata) {
        return;
      }

      const group = blockGroups[blockId];
      if (!group) {
        return;
      }

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

      // Update the group mapping if partyId or block_type changed
      const newPartyId =
        patch.signing_party_id !== undefined ? patch.signing_party_id : group.partyId;

      // Update block group if either partyId or block_type changed
      if (patch.signing_party_id !== undefined || patch.block_type !== undefined) {
        setBlockGroups((prev) => {
          return {
            ...prev,
            [blockId]: {
              ...group,
              partyId: newPartyId,
            },
          };
        });

        // Update the selected group to reflect changes
        setSelectedBlockGroup((prev) => {
          if (!prev) return prev;

          const matches = prev.fieldName === group.fieldName && prev.partyId === group.partyId;

          if (matches) {
            return {
              ...prev,
              partyId: newPartyId,
            };
          }
          return prev;
        });
      }
    },
    [formMetadata, updateBlocks, blockGroups]
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
          ? {
              field_schema: {
                ...block.field_schema,
                field: duplicateFieldKey,
              },
            }
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
        // Check both field_schema and phantom_field_schema since different block types store field name in different places
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

  const handleReorderBlocks = useCallback(
    (reorderedBlocks: IFormBlock[]) => {
      // Ensure all blocks have proper order values
      const blocksWithOrder = reorderedBlocks.map((block, index) => ({
        ...block,
        order: index,
      }));
      updateBlocks(blocksWithOrder);

      // The useMemo hook will automatically rebuild blockGroupsOrder and blockGroups
      // from the new block order, so no need to manually update them here
    },
    [updateBlocks]
  );

  const handleReorderBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      const idx = blocks.findIndex((b) => b._id === blockId);
      if (idx === -1) return;

      const newBlocks = [...blocks];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;

      if (targetIdx < 0 || targetIdx >= newBlocks.length) return;

      [newBlocks[idx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[idx]];
      updateBlocks(newBlocks);
    },
    [blocks, updateBlocks]
  );

  const handleAddPhantomBlock = useCallback(
    (
      type: "header" | "paragraph" | "phantom_field",
      selectedPartyId: string,
      customBlock?: IFormBlock
    ) => {
      let newBlock: IFormBlock;

      if (type === "phantom_field" && customBlock) {
        newBlock = customBlock;
      } else {
        newBlock = {
          _id: `${type}-${Date.now()}`,
        } as IFormBlock;
        newBlock.block_type = type;
        newBlock.signing_party_id = selectedPartyId;
        if (type === "header") {
          newBlock.text_content = "New Header";
        } else if (type === "paragraph") {
          newBlock.text_content = "New Paragraph";
        }
      }

      newBlock.order = blocks.length;
      updateBlocks([...blocks, newBlock]);
    },
    [blocks, updateBlocks]
  );

  const handleSelectFormViewUnit = useCallback(
    (unitId: string) => {
      const group = blockGroups[unitId];
      if (group) {
        setSelectedBlockId(null);
        setSelectedFieldId(null);
        setSelectedBlockGroup(group);
        return;
      }

      const unit = formViewUnits.find((u) => u.id === unitId);
      if (!unit) return;

      setSelectedBlockId(null);
      setSelectedFieldId(null);
      setSelectedBlockGroup({
        id: unit.id,
        fieldName:
          unit.kind === "field"
            ? blocks.find((b) => b._id === unit.primaryBlockId)?.field_schema?.field ||
              blocks.find((b) => b._id === unit.primaryBlockId)?.phantom_field_schema?.field ||
              unit.label
            : unit.kind,
        partyId: unit.partyId || "unknown",
        blockIds: unit.blockIds,
      });
    },
    [blockGroups, blocks, formViewUnits]
  );

  const handleReorderFormViewUnits = useCallback(
    (nextUnitIds: string[]) => {
      if (!formMetadata || !activePartyId) return;
      if (nextUnitIds.length === 0) return;

      const unitsMap = new Map(formViewUnits.map((unit) => [unit.id, unit]));
      const orderedUnits = nextUnitIds
        .map((id) => unitsMap.get(id))
        .filter(Boolean) as FormViewUnit[];
      if (orderedUnits.length === 0) return;

      const orderedBlockIds = orderedUnits.flatMap((unit) => unit.blockIds);
      const idToBlock = new Map(blocks.map((block) => [block._id, block]));
      const replacementBlocks = orderedBlockIds
        .map((blockId) => idToBlock.get(blockId))
        .filter(Boolean) as IFormBlock[];
      const replacementSet = new Set(orderedBlockIds);

      let replacementIndex = 0;
      const reorderedBlocks = blocks.map((block) => {
        if (!replacementSet.has(block._id)) return block;
        const replacement = replacementBlocks[replacementIndex];
        replacementIndex += 1;
        return replacement || block;
      });

      const blocksWithOrder = reorderedBlocks.map((block, index) => ({
        ...block,
        order: index,
      }));
      updateBlocks(blocksWithOrder);
    },
    [activePartyId, blocks, formMetadata, formViewUnits, updateBlocks]
  );

  const handleAddFormTextBlock = useCallback(
    (type: "header" | "paragraph") => {
      const partyId = activePartyId;
      if (!partyId) return;

      const newBlock: IFormBlock = {
        _id: `${type}-${Date.now()}`,
        block_type: type,
        signing_party_id: partyId,
        order: blocks.length,
        text_content: type === "header" ? "New Header" : "New Paragraph",
      } as IFormBlock;

      updateBlocks([...blocks, newBlock]);
      setSelectedBlockId(null);
      setSelectedFieldId(null);
      setSelectedBlockGroup({
        id: newBlock._id,
        fieldName: type,
        partyId: partyId || "unknown",
        blockIds: [newBlock._id],
      });
    },
    [activePartyId, blocks, updateBlocks]
  );

  const value: FormEditorTabContextType = {
    selectedPartyId,
    setSelectedPartyId,
    selectedBlockId,
    setSelectedBlockId,
    selectedFieldId,
    setSelectedFieldId,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
    blockGroupsOrder,
    blockGroups,
    blocksMap: _blocksMap,
    selectedBlockGroup,
    setSelectedBlockGroup,
    blocks,
    searchQuery,
    setSearchQuery,
    preferredPlacementPage,
    setPreferredPlacementPage,
    editorViewMode,
    setEditorViewMode,
    formViewUnits,
    handleBlockSelect,
    handleParentGroupSelect,
    handleBlockUpdate,
    handleBlockCreate,
    handleBlocksCreate,
    handleFieldSelectFromPdf,
    handleParentUpdate,
    handleDuplicateBlock,
    handleDeleteBlock,
    handleDeleteGroupBlocks,
    handleReorderBlocks,
    handleReorderBlock,
    handleAddPhantomBlock,
    handleSelectFormViewUnit,
    handleReorderFormViewUnits,
    handleAddFormTextBlock,
    confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft,
  };

  return <FormEditorTabContext.Provider value={value}>{children}</FormEditorTabContext.Provider>;
}

export function useFormEditorTab() {
  const context = useContext(FormEditorTabContext);
  if (!context) {
    throw new Error("useFormEditorTab must be used within FormEditorTabProvider");
  }
  return context;
}
