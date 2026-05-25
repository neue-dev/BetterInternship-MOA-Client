"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientBlock, IFormBlock } from "@betterinternship/core/forms";
import { GripVertical, Heading, Pilcrow, Plus, Copy, Trash2 } from "lucide-react";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import type { BlocksRendererEditing } from "@/components/docs/forms/FormFillerRenderer";
import { cn } from "@/lib/utils";

type DropPosition = "before" | "after";
type DropTarget = { unitId: string; position: DropPosition };

/**
 * Builds the BlocksRendererEditing adapter that turns the read-only center form
 * preview into a Notion/Tally-style editor: a hover drag handle for reordering
 * (with a full-row drag ghost, grayed source, and gap drop-indicators), hover
 * adders for inserting headers/paragraphs, and inline text editing.
 *
 * Must be called inside FormEditorTabProvider, and should live in a component
 * scoped to the form panel so the local drag state does not re-render sibling
 * panels (e.g. the PDF previewer) on every drag move.
 */
export function useFormPreviewEditing(): BlocksRendererEditing {
  const {
    blocks,
    formViewUnits,
    selectedBlockGroup,
    handleSelectFormViewUnit,
    handleReorderFormViewUnits,
    handleAddFormTextBlock,
    handleAddFormTextBlockAt,
    handleBlockUpdate,
    handleDuplicateBlock,
    handleDeleteBlock,
  } = useFormEditorTab();

  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const unitByBlockId = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of formViewUnits) {
      for (const blockId of unit.blockIds) map.set(blockId, unit.id);
    }
    return map;
  }, [formViewUnits]);

  const unitById = useMemo(() => {
    const map = new Map<string, (typeof formViewUnits)[number]>();
    for (const unit of formViewUnits) map.set(unit.id, unit);
    return map;
  }, [formViewUnits]);

  const commitDrop = useCallback(
    (toId: string, position: DropPosition) => {
      if (!draggedUnitId || draggedUnitId === toId) return;
      const ids = formViewUnits.map((unit) => unit.id);
      const without = ids.filter((id) => id !== draggedUnitId);
      const targetIndex = without.indexOf(toId);
      if (targetIndex === -1) return;
      const insertAt = position === "after" ? targetIndex + 1 : targetIndex;
      without.splice(insertAt, 0, draggedUnitId);
      handleReorderFormViewUnits(without);
    },
    [draggedUnitId, formViewUnits, handleReorderFormViewUnits]
  );

  const resolveUnitId = useCallback(
    // ClientBlock omits _id in its type but carries it at runtime (derived from IFormBlock).
    (block: ClientBlock<any>) =>
      unitByBlockId.get((block as unknown as { _id: string })._id) ?? null,
    [unitByBlockId]
  );

  const renderAddButtons = useCallback(
    (onAdd: (type: "header" | "paragraph") => void) => (
      <div className="pointer-events-auto flex items-center gap-1 rounded-[0.33em] border border-slate-200 bg-white px-1 py-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => onAdd("header")}
          className="flex items-center gap-1 rounded-[0.33em] px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Plus className="h-3 w-3" />
          <Heading className="h-3 w-3" />
          Header
        </button>
        <button
          type="button"
          onClick={() => onAdd("paragraph")}
          className="flex items-center gap-1 rounded-[0.33em] px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Plus className="h-3 w-3" />
          <Pilcrow className="h-3 w-3" />
          Paragraph
        </button>
      </div>
    ),
    []
  );

  const renderTopAdder = useCallback(
    () => (
      <div className="flex justify-center py-1">
        {renderAddButtons((type) => {
          const first = formViewUnits[0];
          if (first) handleAddFormTextBlockAt(type, first.id, "before");
          else handleAddFormTextBlock(type);
        })}
      </div>
    ),
    [renderAddButtons, formViewUnits, handleAddFormTextBlockAt, handleAddFormTextBlock]
  );

  const renderTextBlock = useCallback(
    (block: ClientBlock<any>) => {
      if (block.block_type !== "header" && block.block_type !== "paragraph") return null;
      const blockId = (block as unknown as { _id: string })._id;
      return (
        <EditableTextBlock
          key={`editable-${blockId}`}
          blockId={blockId}
          kind={block.block_type}
          value={block.text_content ?? ""}
          blocks={blocks}
          onCommit={handleBlockUpdate}
        />
      );
    },
    [blocks, handleBlockUpdate]
  );

  const wrapRow = useCallback(
    (rowKey: string, unitId: string, content: React.ReactNode) => {
      const unit = unitById.get(unitId);
      const isSelected = selectedBlockGroup?.id === unitId;
      const isDragged = draggedUnitId === unitId;
      const isTextUnit = unit?.kind === "header" || unit?.kind === "paragraph";
      const showBefore =
        dropTarget?.unitId === unitId && dropTarget.position === "before" && !isDragged;
      const showAfter =
        dropTarget?.unitId === unitId && dropTarget.position === "after" && !isDragged;

      return (
        <div
          key={rowKey}
          data-blockrow
          className={cn(
            "group/blockrow relative rounded-[0.33em] transition-opacity",
            isDragged && "opacity-40"
          )}
          onDragOver={(e) => {
            if (!draggedUnitId) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const position: DropPosition =
              e.clientY < rect.top + rect.height / 2 ? "before" : "after";
            setDropTarget((prev) =>
              prev?.unitId === unitId && prev.position === position
                ? prev
                : { unitId, position }
            );
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dropTarget) commitDrop(dropTarget.unitId, dropTarget.position);
            else if (draggedUnitId) commitDrop(unitId, "before");
            setDraggedUnitId(null);
            setDropTarget(null);
          }}
        >
          {/* Gap drop-indicators */}
          {showBefore && <DropDivider className="-top-1.5" />}
          {showAfter && <DropDivider className="-bottom-1.5" />}

          {/* Leading drag handle (left gutter) */}
          <div
            className={cn(
              "absolute top-1 right-full z-20 mr-1 flex items-center opacity-0 transition-opacity",
              "group-hover/blockrow:opacity-100",
              isSelected && "opacity-100"
            )}
          >
            <div
              role="button"
              tabIndex={0}
              draggable
              aria-label="Drag to reorder"
              title="Drag to reorder"
              onClick={() => handleSelectFormViewUnit(unitId)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", unitId);
                const row = (e.currentTarget as HTMLElement).closest(
                  "[data-blockrow]"
                ) as HTMLElement | null;
                if (row) e.dataTransfer.setDragImage(row, 16, 16);
                setDraggedUnitId(unitId);
              }}
              onDragEnd={() => {
                setDraggedUnitId(null);
                setDropTarget(null);
              }}
              className="flex h-6 w-5 cursor-grab items-center justify-center rounded-[0.33em] text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          </div>

          {/* Trailing controls (text units only) */}
          {isTextUnit && unit && (
            <div
              className={cn(
                "absolute top-1 right-1 z-20 flex items-center gap-0.5 opacity-0 transition-opacity",
                "group-hover/blockrow:opacity-100",
                isSelected && "opacity-100"
              )}
            >
              <button
                type="button"
                title="Duplicate"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const block = blocks.find((b) => b._id === unit.primaryBlockId);
                  if (block) handleDuplicateBlock(block);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-[0.33em] border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBlock(unit.primaryBlockId);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-[0.33em] border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {content}

          {/* Hover adder below the row */}
          <div className="pointer-events-none absolute inset-x-0 -bottom-3 z-10 flex justify-center opacity-0 transition-opacity group-hover/blockrow:opacity-100">
            {renderAddButtons((type) => handleAddFormTextBlockAt(type, unitId, "after"))}
          </div>
        </div>
      );
    },
    [
      unitById,
      selectedBlockGroup,
      draggedUnitId,
      dropTarget,
      blocks,
      commitDrop,
      handleSelectFormViewUnit,
      handleDuplicateBlock,
      handleDeleteBlock,
      renderAddButtons,
      handleAddFormTextBlockAt,
    ]
  );

  return {
    resolveUnitId,
    renderTextBlock,
    renderTopAdder,
    wrapRow,
  };
}

function DropDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex items-center",
        className
      )}
    >
      <span className="bg-primary h-1 w-1 flex-shrink-0 rounded-full" />
      <span className="bg-primary h-0.5 w-full rounded" />
      <span className="bg-primary h-1 w-1 flex-shrink-0 rounded-full" />
    </div>
  );
}

/**
 * Editor-only editable variant of a header/paragraph. Seeded from the block's
 * text_content; persists via handleBlockUpdate on blur. The live signer filler
 * keeps the read-only HeaderRenderer/ParagraphRenderer.
 */
function EditableTextBlock({
  blockId,
  kind,
  value,
  blocks,
  onCommit,
}: {
  blockId: string;
  kind: "header" | "paragraph";
  value: string;
  blocks: IFormBlock[];
  onCommit: (block: IFormBlock) => void;
}) {
  const [text, setText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isFocusedRef = useRef(false);

  // Resync when the underlying value changes from outside (e.g. duplicate,
  // party switch) and we are not actively editing.
  useEffect(() => {
    if (!isFocusedRef.current) setText(value);
  }, [value]);

  const autoSize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoSize();
  }, [autoSize, text]);

  const commit = () => {
    isFocusedRef.current = false;
    if (text === value) return;
    const block = blocks.find((b) => b._id === blockId);
    if (!block) return;
    onCommit({ ...block, text_content: text });
  };

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={commit}
      onInput={autoSize}
      placeholder={kind === "header" ? "Header" : "Paragraph"}
      className={cn(
        "w-full flex-1 resize-none overflow-hidden border-none bg-transparent p-0 outline-none focus:ring-0",
        kind === "header"
          ? "text-3xl font-bold tracking-tight text-gray-700"
          : "py-2 font-normal text-gray-600"
      )}
    />
  );
}
