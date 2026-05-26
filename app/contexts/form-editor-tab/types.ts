import type { IFormBlock } from "@betterinternship/core/forms";

export interface BlockGroup {
  id: string;
  fieldName: string;
  partyId: string;
  blockIds: string[];
}

export interface FormViewUnit {
  id: string;
  kind: "field" | "header" | "paragraph";
  label: string;
  partyId: string;
  blockIds: string[];
  primaryBlockId: string;
}

export type ParentPatch = Record<string, any>;

export interface FormEditorTabContextType {
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
  blockGroupsOrder: string[];
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
  handleAddFormTextBlockAt: (
    type: "header" | "paragraph",
    anchorUnitId: string,
    position: "before" | "after"
  ) => void;
  confirmPendingMissingFieldDraft: () => void;
  cancelPendingMissingFieldDraft: () => void;
}
