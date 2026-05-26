import { useCallback } from "react";
import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import type { FormViewUnit } from "./types";

export function useBlockOrdering({
  formMetadata,
  blocks,
  updateBlocks,
  activePartyId,
  formViewUnits,
}: {
  formMetadata: IFormMetadata | null;
  blocks: IFormBlock[];
  updateBlocks: (blocks: IFormBlock[]) => void;
  activePartyId: string;
  formViewUnits: FormViewUnit[];
}) {
  const handleReorderBlocks = useCallback(
    (reorderedBlocks: IFormBlock[]) => {
      const blocksWithOrder = reorderedBlocks.map((block, index) => ({
        ...block,
        order: index,
      }));
      updateBlocks(blocksWithOrder);
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

  return {
    handleReorderBlocks,
    handleReorderBlock,
    handleReorderFormViewUnits,
  };
}
