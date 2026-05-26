"use client";

import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";
import type { IFormBlock } from "@betterinternship/core/forms";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import {
  type BlockGroup,
  type FormViewUnit,
  getActivePartyId,
  computeFormViewUnits,
  computeBlockGroups,
  appendBlock,
  appendBlocks,
  updateBlock,
  deleteBlock,
  duplicateBlock,
  reorderUnits,
  addTextBlock,
  addTextBlockAt,
} from "@/lib/form-editor-metadata";

export type EditorTab = "editor" | "preview" | "metadata" | "parties" | "subscribers" | "settings";

/**
 * Owns editor session + selection state (active tab, selected party/block/field/
 * group, pending drafts, search) and the interaction handlers that combine a
 * document operation with a selection change. Mounted once above the tab switch
 * so all tabs share the same selection. Derivations are memoized, never synced
 * into state via effects.
 */
interface EditorSelectionContextType {
  // Session / navigation
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  preferredPlacementPage: number;
  setPreferredPlacementPage: (page: number) => void;

  // Selection
  selectedPartyId: string | null;
  setSelectedPartyId: (partyId: string | null) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (blockId: string | null) => void;
  selectedFieldId: string | null;
  setSelectedFieldId: (fieldId: string | null) => void;
  selectedBlockGroup: BlockGroup | null;
  setSelectedBlockGroup: (group: BlockGroup | null) => void;
  pendingMissingFieldDraft: IFormBlock | null;
  setPendingMissingFieldDraft: (block: IFormBlock | null) => void;

  // Derived views
  blocks: IFormBlock[];
  formViewUnits: FormViewUnit[];

  // Interaction handlers
  handleBlockCreate: (block: IFormBlock) => void;
  handleBlocksCreate: (blocks: IFormBlock[]) => void;
  handleBlockUpdate: (block: IFormBlock) => void;
  handleDeleteBlock: (blockId: string) => void;
  handleDuplicateBlock: (block: IFormBlock) => void;
  handleFieldSelectFromPdf: (fieldId: string) => void;
  handleSelectFormViewUnit: (unitId: string) => void;
  handleReorderFormViewUnits: (nextUnitIds: string[]) => void;
  handleAddFormTextBlock: (type: "header" | "paragraph") => void;
  handleAddFormTextBlockAt: (
    type: "header" | "paragraph",
    anchorUnitId: string,
    position: "before" | "after"
  ) => void;
  confirmPendingMissingFieldDraft: () => void;
  cancelPendingMissingFieldDraft: () => void;
}

const EditorSelectionContext = createContext<EditorSelectionContextType | undefined>(undefined);

export function EditorSelectionProvider({ children }: { children: ReactNode }) {
  const { formMetadata, blocks, setFormMetadata, mutateMetadata } = useFormEditorMetadata();

  const [activeTab, setActiveTab] = useState<EditorTab>("editor");
  const [searchQuery, setSearchQuery] = useState("");
  const [preferredPlacementPage, setPreferredPlacementPage] = useState(1);

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(
    formMetadata?.signing_parties?.[0]?._id || null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedBlockGroup, setSelectedBlockGroup] = useState<BlockGroup | null>(null);
  const [pendingMissingFieldDraft, setPendingMissingFieldDraft] = useState<IFormBlock | null>(null);

  // The party whose blocks drive the form-view (units, add/reorder, preview).
  // Tracks the party selected in the top-bar selector, falling back to the first.
  const activePartyId = useMemo(
    () => selectedPartyId || getActivePartyId(formMetadata),
    [selectedPartyId, formMetadata]
  );
  const formViewUnits = useMemo(
    () => computeFormViewUnits(blocks, activePartyId),
    [blocks, activePartyId]
  );
  const blockGroups = useMemo(() => computeBlockGroups(blocks).blockGroups, [blocks]);

  const handleBlockCreate = useCallback(
    (block: IFormBlock) => {
      if (!formMetadata) return;
      const result = appendBlock(formMetadata, block);
      setFormMetadata(result.metadata);
      setSelectedBlockId(result.block._id);
      setSelectedBlockGroup(null);
      setPendingMissingFieldDraft(null);
    },
    [formMetadata, setFormMetadata]
  );

  const handleBlocksCreate = useCallback(
    (newBlocks: IFormBlock[]) => {
      if (!formMetadata || !newBlocks.length) return;
      const result = appendBlocks(formMetadata, newBlocks);
      setFormMetadata(result.metadata);
      setSelectedBlockId(result.blocks[0]?._id || null);
      setSelectedBlockGroup(null);
      setPendingMissingFieldDraft(null);
    },
    [formMetadata, setFormMetadata]
  );

  const handleBlockUpdate = useCallback(
    (block: IFormBlock) => {
      mutateMetadata((prev) => updateBlock(prev, block));
    },
    [mutateMetadata]
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      mutateMetadata((prev) => deleteBlock(prev, blockId));
    },
    [mutateMetadata]
  );

  const handleDuplicateBlock = useCallback(
    (block: IFormBlock) => {
      mutateMetadata((prev) => duplicateBlock(prev, block).metadata);
    },
    [mutateMetadata]
  );

  const handleFieldSelectFromPdf = useCallback(
    (fieldId: string) => {
      setSelectedFieldId(fieldId);
      setSelectedBlockId(fieldId);
      setSelectedBlockGroup(null);
      if (!pendingMissingFieldDraft || pendingMissingFieldDraft._id !== fieldId) {
        setPendingMissingFieldDraft(null);
      }
    },
    [pendingMissingFieldDraft]
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
      mutateMetadata((prev) => reorderUnits(prev, nextUnitIds, formViewUnits));
    },
    [mutateMetadata, formViewUnits]
  );

  const handleAddFormTextBlock = useCallback(
    (type: "header" | "paragraph") => {
      if (!formMetadata || !activePartyId) return;
      const { metadata, block } = addTextBlock(formMetadata, type, activePartyId);
      setFormMetadata(metadata);
      setSelectedBlockId(null);
      setSelectedFieldId(null);
      setSelectedBlockGroup({
        id: block._id,
        fieldName: type,
        partyId: activePartyId || "unknown",
        blockIds: [block._id],
      });
    },
    [formMetadata, activePartyId, setFormMetadata]
  );

  const handleAddFormTextBlockAt = useCallback(
    (type: "header" | "paragraph", anchorUnitId: string, position: "before" | "after") => {
      if (!formMetadata || !activePartyId) return;
      const { metadata, block } = addTextBlockAt(
        formMetadata,
        type,
        activePartyId,
        anchorUnitId,
        position,
        formViewUnits
      );
      setFormMetadata(metadata);
      setSelectedBlockId(null);
      setSelectedFieldId(null);
      setSelectedBlockGroup({
        id: block._id,
        fieldName: type,
        partyId: activePartyId,
        blockIds: [block._id],
      });
    },
    [formMetadata, activePartyId, formViewUnits, setFormMetadata]
  );

  const confirmPendingMissingFieldDraft = useCallback(() => {
    if (!pendingMissingFieldDraft || !formMetadata) return;
    const { metadata, block } = appendBlock(formMetadata, pendingMissingFieldDraft);
    setFormMetadata(metadata);
    setPendingMissingFieldDraft(null);
    setSelectedBlockId(block._id);
    setSelectedBlockGroup(null);
  }, [formMetadata, pendingMissingFieldDraft, setFormMetadata]);

  const cancelPendingMissingFieldDraft = useCallback(() => {
    if (!pendingMissingFieldDraft) return;
    setPendingMissingFieldDraft(null);
    if (selectedBlockId === pendingMissingFieldDraft._id) {
      setSelectedBlockId(null);
    }
  }, [pendingMissingFieldDraft, selectedBlockId]);

  const value: EditorSelectionContextType = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      searchQuery,
      setSearchQuery,
      preferredPlacementPage,
      setPreferredPlacementPage,
      selectedPartyId,
      setSelectedPartyId,
      selectedBlockId,
      setSelectedBlockId,
      selectedFieldId,
      setSelectedFieldId,
      selectedBlockGroup,
      setSelectedBlockGroup,
      pendingMissingFieldDraft,
      setPendingMissingFieldDraft,
      blocks,
      formViewUnits,
      handleBlockCreate,
      handleBlocksCreate,
      handleBlockUpdate,
      handleDeleteBlock,
      handleDuplicateBlock,
      handleFieldSelectFromPdf,
      handleSelectFormViewUnit,
      handleReorderFormViewUnits,
      handleAddFormTextBlock,
      handleAddFormTextBlockAt,
      confirmPendingMissingFieldDraft,
      cancelPendingMissingFieldDraft,
    }),
    [
      activeTab,
      searchQuery,
      preferredPlacementPage,
      selectedPartyId,
      selectedBlockId,
      selectedFieldId,
      selectedBlockGroup,
      pendingMissingFieldDraft,
      blocks,
      formViewUnits,
      handleBlockCreate,
      handleBlocksCreate,
      handleBlockUpdate,
      handleDeleteBlock,
      handleDuplicateBlock,
      handleFieldSelectFromPdf,
      handleSelectFormViewUnit,
      handleReorderFormViewUnits,
      handleAddFormTextBlock,
      handleAddFormTextBlockAt,
      confirmPendingMissingFieldDraft,
      cancelPendingMissingFieldDraft,
    ]
  );

  return (
    <EditorSelectionContext.Provider value={value}>{children}</EditorSelectionContext.Provider>
  );
}

export function useEditorSelection() {
  const context = useContext(EditorSelectionContext);
  if (!context) {
    throw new Error("useEditorSelection must be used within EditorSelectionProvider");
  }
  return context;
}
