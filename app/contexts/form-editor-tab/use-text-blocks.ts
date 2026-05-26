import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { IFormBlock } from "@betterinternship/core/forms";
import type { BlockGroup, FormViewUnit } from "./types";

export function useTextBlocks({
  blocks,
  updateBlocks,
  activePartyId,
  formViewUnits,
  setSelectedBlockId,
  setSelectedFieldId,
  setSelectedBlockGroup,
}: {
  blocks: IFormBlock[];
  updateBlocks: (blocks: IFormBlock[]) => void;
  activePartyId: string;
  formViewUnits: FormViewUnit[];
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  setSelectedFieldId: Dispatch<SetStateAction<string | null>>;
  setSelectedBlockGroup: Dispatch<SetStateAction<BlockGroup | null>>;
}) {
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
        newBlock = { _id: `${type}-${Date.now()}` } as IFormBlock;
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
    [activePartyId, blocks, updateBlocks, setSelectedBlockId, setSelectedFieldId, setSelectedBlockGroup]
  );

  const handleAddFormTextBlockAt = useCallback(
    (type: "header" | "paragraph", anchorUnitId: string, position: "before" | "after") => {
      const partyId = activePartyId;
      if (!partyId) return;

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
          insertIndex =
            position === "before" ? indices[0] : indices[indices.length - 1] + 1;
        }
      }

      const nextBlocks = [...blocks];
      nextBlocks.splice(insertIndex, 0, newBlock);
      const blocksWithOrder = nextBlocks.map((block, index) => ({ ...block, order: index }));

      updateBlocks(blocksWithOrder);
      setSelectedBlockId(null);
      setSelectedFieldId(null);
      setSelectedBlockGroup({
        id: newBlock._id,
        fieldName: type,
        partyId,
        blockIds: [newBlock._id],
      });
    },
    [activePartyId, blocks, formViewUnits, updateBlocks, setSelectedBlockId, setSelectedFieldId, setSelectedBlockGroup]
  );

  return {
    handleAddPhantomBlock,
    handleAddFormTextBlock,
    handleAddFormTextBlockAt,
  };
}
