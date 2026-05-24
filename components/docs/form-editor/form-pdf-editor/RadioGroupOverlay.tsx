"use client";

import { IFormBlock } from "@betterinternship/core/forms";
import { Plus } from "lucide-react";
import { useMemo, useRef } from "react";

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
  onGroupDragMove: (groupId: string, displayDeltaX: number, displayDeltaY: number) => void;
  onGroupDragEnd: (groupId: string, displayDeltaX: number, displayDeltaY: number) => void;
  onGroupClick?: (groupId: string) => void;
  activeDrag: { groupId: string; x: number; y: number } | null;
};

export function RadioGroupOverlay({
  blocks,
  pdfToDisplay,
  scale,
  onAddOption,
  onGroupDragMove,
  onGroupDragEnd,
  onGroupClick,
  activeDrag,
}: Props) {
  const groups = useMemo<RadioGroupInfo[]>(() => {
    const map = new Map<string, IFormBlock[]>();
    for (const block of blocks) {
      const groupId = block.field_schema?.radio_group_id as string | undefined;
      if (!groupId) continue;
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId)!.push(block);
    }
    return Array.from(map.entries()).map(([groupId, groupBlocks]) => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
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

  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleBorderMouseDown = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    dragOffsetRef.current = { x: 0, y: 0 };

    const handleMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      dragOffsetRef.current = { x: dx, y: dy };
      onGroupDragMove(groupId, dx, dy);
    };

    const handleUp = () => {
      onGroupDragEnd(groupId, dragOffsetRef.current.x, dragOffsetRef.current.y);
      dragOffsetRef.current = { x: 0, y: 0 };
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  return (
    <>
      {groups.map((group) => {
        const pad = 6;
        const topLeft = pdfToDisplay(group.minX - pad, group.minY - pad);
        const bottomRight = pdfToDisplay(group.maxX + pad, group.maxY + pad);
        if (!topLeft || !bottomRight) return null;

        const width = bottomRight.displayX - topLeft.displayX;
        const height = bottomRight.displayY - topLeft.displayY;
        const isDragging = activeDrag?.groupId === group.groupId;
        const offsetX = isDragging ? activeDrag!.x : 0;
        const offsetY = isDragging ? activeDrag!.y : 0;

        // Strip width matches the padding area in display pixels
        const stripPx = Math.max(8, Math.round(pad * scale));
        const grabCursor = isDragging ? "grabbing" : "grab";

        const stripStyle = (side: "top" | "right" | "bottom" | "left"): React.CSSProperties => {
          const base: React.CSSProperties = {
            position: "absolute",
            pointerEvents: "auto",
            cursor: grabCursor,
          };
          if (side === "top") return { ...base, top: 0, left: 0, right: 0, height: stripPx };
          if (side === "bottom") return { ...base, bottom: 0, left: 0, right: 0, height: stripPx };
          if (side === "left")
            return { ...base, top: stripPx, left: 0, bottom: stripPx, width: stripPx };
          return { ...base, top: stripPx, right: 0, bottom: stripPx, width: stripPx };
        };

        return (
          <div
            key={group.groupId}
            className="absolute z-10"
            style={{
              left: `${topLeft.displayX}px`,
              top: `${topLeft.displayY}px`,
              width: `${width}px`,
              height: `${height}px`,
              transform: `translate(${offsetX}px, ${offsetY}px)`,
              border: "2px dashed rgba(99, 102, 241, 0.5)",
              borderRadius: "4px",
              pointerEvents: "auto",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onGroupClick?.(group.groupId);
            }}
          >
            {/* Four border strips — only these capture mouse events */}
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <div
                key={side}
                style={stripStyle(side)}
                onMouseDown={(e) => handleBorderMouseDown(e, group.groupId)}
                onClick={(e) => {
                  e.stopPropagation();
                  onGroupClick?.(group.groupId);
                }}
              />
            ))}

            <button
              type="button"
              className="pointer-events-auto absolute -right-3 -bottom-3 z-30 inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-white text-indigo-600 shadow-sm hover:bg-indigo-50"
              style={{ cursor: "default" }}
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
