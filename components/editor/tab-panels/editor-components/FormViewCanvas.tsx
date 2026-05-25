"use client";

import { useState } from "react";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { cn } from "@/lib/utils";
import { GripVertical, Heading, Pilcrow, Type, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormViewCanvas() {
  const {
    blocks,
    formViewUnits,
    selectedBlockGroup,
    handleSelectFormViewUnit,
    handleReorderFormViewUnits,
    handleAddFormTextBlock,
    handleDeleteBlock,
    handleDuplicateBlock,
  } = useFormEditorTab();
  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null);
  const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);

  const moveUnitToTarget = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const unitIds = formViewUnits.map((unit) => unit.id);
    const fromIndex = unitIds.indexOf(fromId);
    const toIndex = unitIds.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...unitIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    handleReorderFormViewUnits(next);
  };

  return (
    <div className="h-full overflow-auto p-3">
      <div className="flex h-full flex-col gap-2">
        <div className="space-y-1">
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-[0.33em]"
              onClick={() => handleAddFormTextBlock("header")}
            >
              <Heading className="mr-1.5 h-3.5 w-3.5" />
              Add Header
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-[0.33em]"
              onClick={() => handleAddFormTextBlock("paragraph")}
            >
              <Pilcrow className="mr-1.5 h-3.5 w-3.5" />
              Add Paragraph
            </Button>
          </div>
        </div>

        {formViewUnits.length === 0 ? (
          <div className="text-muted-foreground rounded-[0.33em] border border-slate-200 bg-white p-6 text-center text-sm">
            No blocks for this recipient yet.
          </div>
        ) : (
          <div className="space-y-1.5 overflow-auto pr-0.5">
            {formViewUnits.map((unit) => {
              const isSelected = selectedBlockGroup?.id === unit.id;
              const isDragging = draggedUnitId === unit.id;
              const isDropTarget = dragOverUnitId === unit.id && draggedUnitId !== unit.id;
              const UnitIcon =
                unit.kind === "header" ? Heading : unit.kind === "paragraph" ? Pilcrow : Type;
              const unitLabel =
                unit.kind === "header"
                  ? "Header"
                  : unit.kind === "paragraph"
                    ? "Paragraph"
                    : "Field";
              return (
                <button
                  key={unit.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedUnitId(unit.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverUnitId(unit.id);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverUnitId(unit.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedUnitId) moveUnitToTarget(draggedUnitId, unit.id);
                    setDraggedUnitId(null);
                    setDragOverUnitId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedUnitId(null);
                    setDragOverUnitId(null);
                  }}
                  onDragLeave={() => {
                    if (dragOverUnitId === unit.id) setDragOverUnitId(null);
                  }}
                  onClick={() => handleSelectFormViewUnit(unit.id)}
                  className={cn(
                    "flex w-full transform-gpu items-center gap-3 rounded-[0.33em] border px-3 py-2.5 text-left motion-safe:transition-all motion-safe:duration-150",
                    isSelected
                      ? "border-primary/40 bg-primary/5"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    isDragging && "scale-[0.99] opacity-70",
                    isDropTarget && "border-primary/50 bg-primary/10 shadow-sm"
                  )}
                >
                  <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[0.33em] bg-slate-100 text-slate-600">
                    <UnitIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{unit.label}</p>
                    <p className="text-xs text-slate-500">{unitLabel}</p>
                  </div>
                  {(unit.kind === "header" || unit.kind === "paragraph") && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[0.33em] border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const block = blocks.find((b) => b._id === unit.primaryBlockId);
                          if (block) handleDuplicateBlock(block);
                        }}
                        title={`Duplicate ${unitLabel.toLowerCase()}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[0.33em] border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(unit.primaryBlockId);
                        }}
                        title={`Delete ${unitLabel.toLowerCase()}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {unit.blockIds.length > 1 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {unit.blockIds.length} linked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
