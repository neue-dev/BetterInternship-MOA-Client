"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getPartyColorByIndex } from "@/lib/party-colors";
import { ArrowLeft, ArrowRight, ChevronDown, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FormField = {
  id: string;
  field: string;
  label: string;
  tooltip_label?: string;
  type: "text" | "signature" | "image";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isPhantom?: boolean;
  signing_party_order?: number;
  signing_party_id?: string;
  size?: number;
  font?: string;
  align_v?: "top" | "middle" | "bottom";
  wrap?: boolean;
};

type ResizeHandle = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

export type FieldBoxProps = {
  field: FormField;
  isSelected?: boolean;
  onSelect?: () => void;
  onDrag?: (deltaX: number, deltaY: number) => void;
  onDragEnd?: () => void;
  onResize?: (handle: ResizeHandle, deltaX: number, deltaY: number) => void;
  onResizeEnd?: () => void;
  signingPartyOptions?: { id: string; name: string }[];
  onSigningPartyChange?: (partyId: string) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  sameFieldIndex?: number;
  sameFieldCount?: number;
  onPrevSameField?: () => void;
  onNextSameField?: () => void;
  showBaselineGuide?: boolean;
  baselineGuideOffsetPx?: number;
  showInlineDelete?: boolean;
  onInlineDelete?: () => void;
};

export const FieldBox = ({
  field,
  isSelected,
  onSelect,
  onDrag,
  onDragEnd,
  onResize,
  onResizeEnd,
  signingPartyOptions = [],
  onSigningPartyChange,
  onDelete,
  onDuplicate,
  sameFieldIndex = 1,
  sameFieldCount = 1,
  onPrevSameField,
  onNextSameField,
  showBaselineGuide = false,
  baselineGuideOffsetPx,
  showInlineDelete = false,
  onInlineDelete,
}: FieldBoxProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [toolbarShiftX, setToolbarShiftX] = useState(0);
  const dragState = useRef<{ startX: number; startY: number } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    handle: ResizeHandle;
  } | null>(null);

  const partyOrder = field.signing_party_order || 1;
  const colorIndex = partyOrder - 1;
  const partyColor = getPartyColorByIndex(colorIndex);
  const selectedPartyColor = useMemo(() => {
    const selected = signingPartyOptions.find((party) => party.id === field.signing_party_id);
    if (!selected) return partyColor.hex;
    const idx = Math.max(
      0,
      signingPartyOptions.findIndex((party) => party.id === selected.id)
    );
    return getPartyColorByIndex(idx).hex;
  }, [field.signing_party_id, partyColor.hex, signingPartyOptions]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelected && onSelect) onSelect();

    e.stopPropagation();
    e.preventDefault();

    dragState.current = { startX: e.clientX, startY: e.clientY };
    dragOffsetRef.current = { x: 0, y: 0 };
    setIsDragging(true);

    const handleMove = (moveEvent: MouseEvent) => {
      if (!dragState.current || !elementRef.current) return;

      const deltaX = moveEvent.clientX - dragState.current.startX;
      const deltaY = moveEvent.clientY - dragState.current.startY;

      dragOffsetRef.current = { x: deltaX, y: deltaY };
      elementRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    };

    const handleUp = () => {
      if (onDrag && dragState.current) {
        onDrag(dragOffsetRef.current.x, dragOffsetRef.current.y);
      }
      dragState.current = null;
      setIsDragging(false);

      if (elementRef.current) {
        elementRef.current.style.transform = "";
      }
      dragOffsetRef.current = { x: 0, y: 0 };

      onDragEnd?.();
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    if (!isSelected && onSelect) onSelect();

    e.stopPropagation();
    e.preventDefault();

    resizeState.current = { startX: e.clientX, startY: e.clientY, handle };
    setIsResizing(true);

    const handleMove = (moveEvent: MouseEvent) => {
      if (!resizeState.current || !onResize) return;

      const deltaX = moveEvent.clientX - resizeState.current.startX;
      const deltaY = moveEvent.clientY - resizeState.current.startY;

      onResize(resizeState.current.handle, deltaX, deltaY);
    };

    const handleUp = () => {
      resizeState.current = null;
      setIsResizing(false);
      onResizeEnd?.();
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const showQuickActions = !!isSelected;
  const shouldShowBaseline =
    showBaselineGuide &&
    (field.type === "text" || field.type === "signature") &&
    typeof baselineGuideOffsetPx === "number" &&
    Number.isFinite(baselineGuideOffsetPx);

  useEffect(() => {
    if (!showQuickActions) {
      setToolbarShiftX(0);
      return;
    }

    const adjustToolbarPosition = () => {
      const toolbarEl = toolbarRef.current;
      if (!toolbarEl) return;

      const rect = toolbarEl.getBoundingClientRect();
      const viewportPadding = 12;

      let shift = 0;
      const overflowRight = rect.right - (window.innerWidth - viewportPadding);
      if (overflowRight > 0) {
        shift -= overflowRight;
      }

      const overflowLeft = viewportPadding - rect.left;
      if (overflowLeft > 0) {
        shift += overflowLeft;
      }

      setToolbarShiftX(Math.round(shift));
    };

    const frame = window.requestAnimationFrame(adjustToolbarPosition);
    window.addEventListener("resize", adjustToolbarPosition);
    window.addEventListener("scroll", adjustToolbarPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", adjustToolbarPosition);
      window.removeEventListener("scroll", adjustToolbarPosition, true);
    };
  }, [showQuickActions, field.id, field.w, field.h]);

  return (
    <div
      ref={elementRef}
      className={cn("group absolute inset-0 border transition-colors")}
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      title={field.label}
      style={{
        borderColor: partyColor.hex,
        borderStyle: "solid",
        borderWidth: "2px",
        backgroundColor: isSelected ? partyColor.hex + "50" : partyColor.hex + "75",
        cursor: isDragging ? "grabbing" : isResizing ? "grabbing" : isSelected ? "grab" : "pointer",
      }}
    >
      <div
        className="text-muted-foreground pointer-events-none overflow-hidden font-semibold"
        style={{
          fontSize: `clamp(7px, ${Math.min(field.h * 0.75, 16)}px, 12px)`,
          lineHeight: 1.2,
          wordWrap: "break-word",
          whiteSpace: "normal",
          padding: "2px 2px",
        }}
      >
        {field.label}
      </div>

      {showInlineDelete && (
        <button
          type="button"
          className="absolute -top-1.5 -left-1.5 z-30 inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-300 bg-white text-red-500 text-[10px] font-bold leading-none hover:bg-red-50"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onInlineDelete?.();
          }}
          title="Remove radio option"
        >
          −
        </button>
      )}

      {shouldShowBaseline && (
        <div
          className="pointer-events-none absolute right-0 left-0"
          style={{
            top: `${baselineGuideOffsetPx}px`,
            borderTop: "1px dashed rgba(57, 255, 20, 0.95)",
          }}
        />
      )}

      {showQuickActions && (
        <div
          ref={toolbarRef}
          className="absolute -top-14 left-0 z-50 flex h-11 items-center gap-2 rounded-[0.33em] border border-slate-200/90 bg-white/95 px-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{ transform: `translateX(${toolbarShiftX}px)` }}
        >
          {signingPartyOptions.length > 0 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 max-w-44 items-center justify-between gap-1.5 rounded-[0.33em] border border-slate-200 bg-slate-50 px-2 text-xs transition-colors hover:bg-slate-100"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <span
                    className="max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: selectedPartyColor }}
                  >
                    {signingPartyOptions.find((party) => party.id === field.signing_party_id)
                      ?.name || "Select recipient"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-[var(--radix-dropdown-menu-trigger-width)]"
              >
                {signingPartyOptions.map((party, index) => {
                  const color = getPartyColorByIndex(Math.max(0, index));
                  return (
                    <DropdownMenuItem
                      key={party.id}
                      onClick={() => onSigningPartyChange?.(party.id)}
                      className="py-1.5"
                    >
                      <span
                        className="max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: color.hex }}
                      >
                        {party.name}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[0.33em] border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onDuplicate?.()}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[0.33em] border border-red-200/70 bg-red-50/60 text-red-600 transition-colors hover:bg-red-50"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onDelete?.()}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="inline-flex h-8 items-center overflow-hidden rounded-[0.33em] border border-slate-200 bg-slate-50">
            <button
              type="button"
              className="hover:text-primary focus-visible:ring-primary/40 inline-flex h-8 w-8 items-center justify-center text-slate-600 transition-colors hover:bg-slate-200/80 focus-visible:ring-2 focus-visible:outline-none active:bg-slate-300/70 disabled:cursor-not-allowed disabled:opacity-40"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onPrevSameField?.()}
              title="Previous same field"
              disabled={sameFieldCount <= 1}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="mb-0.5 inline-flex h-8 items-center justify-center text-sm font-semibold text-slate-700 px-1">
              {sameFieldIndex}/{sameFieldCount}
            </div>
            <button
              type="button"
              className="hover:text-primary focus-visible:ring-primary/40 inline-flex h-8 w-8 items-center justify-center text-slate-600 transition-colors hover:bg-slate-200/80 focus-visible:ring-2 focus-visible:outline-none active:bg-slate-300/70 disabled:cursor-not-allowed disabled:opacity-40"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onNextSameField?.()}
              title="Next same field"
              disabled={sameFieldCount <= 1}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {isSelected && (
        <>
          <div
            className="absolute -top-2 left-1/2 hidden h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "n")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute top-1/2 -right-2 hidden h-3 w-3 -translate-y-1/2 cursor-ew-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "e")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute -bottom-2 left-1/2 hidden h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "s")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute top-1/2 -left-2 hidden h-3 w-3 -translate-y-1/2 cursor-ew-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "w")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute -top-2 -left-2 hidden h-3 w-3 cursor-nwse-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute -top-2 -right-2 hidden h-3 w-3 cursor-nesw-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute -bottom-2 -left-2 hidden h-3 w-3 cursor-nesw-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
          <div
            className="absolute -right-2 -bottom-2 hidden h-3 w-3 cursor-nwse-resize rounded-full group-hover:block"
            onMouseDown={(e) => handleResizeStart(e, "se")}
            style={{ backgroundColor: partyColor.hex, pointerEvents: "auto" }}
          />
        </>
      )}
    </div>
  );
};
