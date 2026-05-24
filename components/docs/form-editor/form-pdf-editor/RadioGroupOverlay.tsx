"use client";

import { IFormBlock } from "@betterinternship/core/forms";
import { Plus } from "lucide-react";
import { useMemo } from "react";

type RadioGroupInfo = {
  groupId: string;
  blocks: IFormBlock[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Props = {
  blocks: IFormBlock[];
  pdfToDisplay: (pdfX: number, pdfY: number) => { displayX: number; displayY: number } | null;
  scale: number;
  onAddOption: (groupId: string) => void;
};

export function RadioGroupOverlay({ blocks, pdfToDisplay, scale: _scale, onAddOption }: Props) {
  const groups = useMemo<RadioGroupInfo[]>(() => {
    const map = new Map<string, IFormBlock[]>();
    for (const block of blocks) {
      const groupId = (block.field_schema as any)?.radio_group_id as string | undefined;
      if (!groupId) continue;
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId)!.push(block);
    }

    return Array.from(map.entries()).map(([groupId, groupBlocks]) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const b of groupBlocks) {
        const s = b.field_schema!;
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.w);
        maxY = Math.max(maxY, s.y + s.h);
      }
      return { groupId, blocks: groupBlocks, minX, minY, maxX, maxY };
    });
  }, [blocks]);

  return (
    <>
      {groups.map((group) => {
        const pad = 6;
        const topLeft = pdfToDisplay(group.minX - pad, group.minY - pad);
        const bottomRight = pdfToDisplay(group.maxX + pad, group.maxY + pad);
        if (!topLeft || !bottomRight) return null;

        const width = bottomRight.displayX - topLeft.displayX;
        const height = bottomRight.displayY - topLeft.displayY;

        return (
          <div
            key={group.groupId}
            className="pointer-events-none absolute z-10"
            style={{
              left: `${topLeft.displayX}px`,
              top: `${topLeft.displayY}px`,
              width: `${width}px`,
              height: `${height}px`,
              border: "2px dashed rgba(99, 102, 241, 0.5)",
              borderRadius: "4px",
            }}
          >
            <button
              type="button"
              className="pointer-events-auto absolute -bottom-3 -right-3 z-30 inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-white text-indigo-600 shadow-sm hover:bg-indigo-50"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAddOption(group.groupId);
              }}
              title="Add radio option"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </>
  );
}
