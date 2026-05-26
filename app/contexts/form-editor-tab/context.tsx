"use client";

import { createContext, useContext, useState, useMemo, useEffect, ReactNode } from "react";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import type { FormEditorTabContextType } from "./types";
import { useBlockGroups } from "./use-block-groups";
import { useSelectionState } from "./use-selection-state";
import { useBlockMutations } from "./use-block-mutations";
import { useBlockOrdering } from "./use-block-ordering";
import { useTextBlocks } from "./use-text-blocks";

const FormEditorTabContext = createContext<FormEditorTabContextType | undefined>(undefined);

export function FormEditorTabProvider({ children }: { children: ReactNode }) {
  const { formMetadata, updateBlocks } = useFormEditor();

  const [searchQuery, setSearchQuery] = useState("");
  const [preferredPlacementPage, setPreferredPlacementPage] = useState(1);

  const blocks = useMemo(() => formMetadata?.schema.blocks || [], [formMetadata]);

  // Normalize block order indices when they drift out of sync.
  useEffect(() => {
    if (!formMetadata || blocks.length === 0) return;
    const needsOrderNormalization = blocks.some((block, index) => (block.order ?? -1) !== index);
    if (!needsOrderNormalization) return;
    updateBlocks(blocks.map((block, index) => ({ ...block, order: index })));
  }, [blocks, formMetadata, updateBlocks]);

  const blocksMap = useMemo(() => {
    const map: Record<string, (typeof blocks)[number]> = {};
    blocks.forEach((block) => { map[block._id] = block; });
    return map;
  }, [blocks]);

  const blockGroupsHook = useBlockGroups({ formMetadata, blocks });

  const selectionHook = useSelectionState({
    formMetadata,
    updateBlocks,
    findGroupByBlockId: blockGroupsHook.findGroupByBlockId,
    blockGroups: blockGroupsHook.blockGroups,
    setBlockGroups: blockGroupsHook.setBlockGroups,
    setBlockGroupsOrder: blockGroupsHook.setBlockGroupsOrder,
    formViewUnits: blockGroupsHook.formViewUnits,
    blocks,
  });

  const mutationsHook = useBlockMutations({
    formMetadata,
    blocks,
    updateBlocks,
    blockGroups: blockGroupsHook.blockGroups,
    setBlockGroups: blockGroupsHook.setBlockGroups,
    setSelectedBlockId: selectionHook.setSelectedBlockId,
    setSelectedBlockGroup: selectionHook.setSelectedBlockGroup,
    setPendingMissingFieldDraft: selectionHook.setPendingMissingFieldDraft,
  });

  const orderingHook = useBlockOrdering({
    formMetadata,
    blocks,
    updateBlocks,
    activePartyId: blockGroupsHook.activePartyId,
    formViewUnits: blockGroupsHook.formViewUnits,
  });

  const textBlocksHook = useTextBlocks({
    blocks,
    updateBlocks,
    activePartyId: blockGroupsHook.activePartyId,
    formViewUnits: blockGroupsHook.formViewUnits,
    setSelectedBlockId: selectionHook.setSelectedBlockId,
    setSelectedFieldId: selectionHook.setSelectedFieldId,
    setSelectedBlockGroup: selectionHook.setSelectedBlockGroup,
  });

  const value: FormEditorTabContextType = {
    // Selection state
    selectedPartyId: selectionHook.selectedPartyId,
    setSelectedPartyId: selectionHook.setSelectedPartyId,
    selectedBlockId: selectionHook.selectedBlockId,
    setSelectedBlockId: selectionHook.setSelectedBlockId,
    selectedFieldId: selectionHook.selectedFieldId,
    setSelectedFieldId: selectionHook.setSelectedFieldId,
    pendingMissingFieldDraft: selectionHook.pendingMissingFieldDraft,
    setPendingMissingFieldDraft: selectionHook.setPendingMissingFieldDraft,
    selectedBlockGroup: selectionHook.selectedBlockGroup,
    setSelectedBlockGroup: selectionHook.setSelectedBlockGroup,

    // Block group state
    blockGroupsOrder: blockGroupsHook.blockGroupsOrder,
    blockGroups: blockGroupsHook.blockGroups,
    blocksMap,

    // Blocks + derived view
    blocks,
    formViewUnits: blockGroupsHook.formViewUnits,

    // UI state
    searchQuery,
    setSearchQuery,
    preferredPlacementPage,
    setPreferredPlacementPage,

    // Selection handlers
    handleBlockSelect: selectionHook.handleBlockSelect,
    handleParentGroupSelect: selectionHook.handleParentGroupSelect,
    handleFieldSelectFromPdf: selectionHook.handleFieldSelectFromPdf,
    handleSelectFormViewUnit: selectionHook.handleSelectFormViewUnit,
    confirmPendingMissingFieldDraft: selectionHook.confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft: selectionHook.cancelPendingMissingFieldDraft,

    // Block mutation handlers
    handleBlockUpdate: mutationsHook.handleBlockUpdate,
    handleBlockCreate: mutationsHook.handleBlockCreate,
    handleBlocksCreate: mutationsHook.handleBlocksCreate,
    handleDuplicateBlock: mutationsHook.handleDuplicateBlock,
    handleDeleteBlock: mutationsHook.handleDeleteBlock,
    handleDeleteGroupBlocks: mutationsHook.handleDeleteGroupBlocks,
    handleParentUpdate: mutationsHook.handleParentUpdate,

    // Ordering handlers
    handleReorderBlocks: orderingHook.handleReorderBlocks,
    handleReorderBlock: orderingHook.handleReorderBlock,
    handleReorderFormViewUnits: orderingHook.handleReorderFormViewUnits,

    // Text block handlers
    handleAddPhantomBlock: textBlocksHook.handleAddPhantomBlock,
    handleAddFormTextBlock: textBlocksHook.handleAddFormTextBlock,
    handleAddFormTextBlockAt: textBlocksHook.handleAddFormTextBlockAt,
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
