import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import type { BlockGroup, FormViewUnit } from "./types";
import { ensureRequiredRuleOnNewBlock } from "./helpers";

export function useSelectionState({
  formMetadata,
  updateBlocks,
  findGroupByBlockId,
  blockGroups,
  setBlockGroups,
  setBlockGroupsOrder,
  formViewUnits,
  blocks,
}: {
  formMetadata: IFormMetadata | null;
  updateBlocks: (blocks: IFormBlock[]) => void;
  findGroupByBlockId: (blockId: string) => BlockGroup | null;
  blockGroups: Record<string, BlockGroup>;
  setBlockGroups: Dispatch<SetStateAction<Record<string, BlockGroup>>>;
  setBlockGroupsOrder: Dispatch<SetStateAction<string[]>>;
  formViewUnits: FormViewUnit[];
  blocks: IFormBlock[];
}) {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(
    formMetadata?.signing_parties?.[0]?._id || null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedBlockGroup, setSelectedBlockGroup] = useState<BlockGroup | null>(null);
  const [pendingMissingFieldDraft, setPendingMissingFieldDraft] = useState<IFormBlock | null>(null);

  const handleBlockSelect = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId || null);
      const group = findGroupByBlockId(blockId);
      setSelectedBlockGroup(group);
    },
    [findGroupByBlockId]
  );

  const handleParentGroupSelect = useCallback((blockId: string, group: BlockGroup | null) => {
    if (!group) return;
    const groupId = group.id;

    setBlockGroups((prev) => {
      if (prev[groupId]) return prev;
      return { ...prev, [groupId]: group };
    });
    setBlockGroupsOrder((prev) => {
      if (prev.includes(groupId)) return prev;
      return [...prev, groupId];
    });
    setSelectedBlockGroup(group);
  }, [setBlockGroups, setBlockGroupsOrder]);

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

  const confirmPendingMissingFieldDraft = useCallback(() => {
    if (!pendingMissingFieldDraft || !formMetadata) return;

    const nextOrder = formMetadata.schema.blocks.length;
    const normalizedDraft = ensureRequiredRuleOnNewBlock(pendingMissingFieldDraft);
    updateBlocks([
      ...formMetadata.schema.blocks,
      { ...normalizedDraft, order: nextOrder },
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

  return {
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
    handleBlockSelect,
    handleParentGroupSelect,
    handleFieldSelectFromPdf,
    handleSelectFormViewUnit,
    confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft,
  };
}
