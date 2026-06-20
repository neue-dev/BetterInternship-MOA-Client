"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getPartyColorByIndex, getPartyColorByOrder } from "@betterinternship/core/pdf-viewer";
import { ArrowLeft, ArrowRight, ChevronDown, Copy, Trash2 } from "lucide-react";
import { computeSnapToGrid, snapResizeEdge, type FieldRect } from "@/lib/snap-to-grid";
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

const RESIZE_HANDLE_CLASSES: Record<ResizeHandle, string> = {
  n:  "absolute -top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
  e:  "absolute top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize",
  s:  "absolute -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
  w:  "absolute top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize",
  nw: "absolute -top-1.5 -left-1.5 cursor-nwse-resize",
  ne: "absolute -top-1.5 -right-1.5 cursor-nesw-resize",
  sw: "absolute -bottom-1.5 -left-1.5 cursor-nesw-resize",
  se: "absolute -right-1.5 -bottom-1.5 cursor-nwse-resize",
};

const DRAG_THRESHOLD = 5;
const TOOLBAR_WIDTH = 288;

function ResizeHandleDot({
  handle,
  colorHex,
  onMouseDown,
}: {
  handle: ResizeHandle;
  colorHex: string;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const invisible = colorHex === "transparent";
  return (
    <div
      className={cn(invisible ? "h-4 w-4" : "h-2.5 w-2.5 rounded-full border-2 shadow-sm", RESIZE_HANDLE_CLASSES[handle])}
      onMouseDown={onMouseDown}
      style={{
        backgroundColor: invisible ? "transparent" : "white",
        borderColor: invisible ? "transparent" : colorHex,
        pointerEvents: "auto",
      }}
    />
  );
}

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
  settingsContent?: React.ReactNode;
  onDeselect?: () => void;
  snapTargets?: FieldRect[];
  onSnapGuides?: (guideX: number | null, guideY: number | null) => void;
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
  settingsContent,
  onDeselect,
  snapTargets,
  onSnapGuides,
}: FieldBoxProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [toolbarFlipLeft, setToolbarFlipLeft] = useState(false);
  const hasDraggedRef = useRef(false);
  const dragState = useRef<{ startX: number; startY: number } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const [settingsScrollbarWidth, setSettingsScrollbarWidth] = useState(0);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    handle: ResizeHandle;
    initialW: number;
    initialH: number;
    initialLeft: number;
    initialTop: number;
    lastDeltaX: number;
    lastDeltaY: number;
  } | null>(null);

  const partyColor = getPartyColorByOrder(field.signing_party_order || 1);
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

    hasDraggedRef.current = false;
    dragState.current = { startX: e.clientX, startY: e.clientY };
    dragOffsetRef.current = { x: 0, y: 0 };

    const handleMove = (moveEvent: MouseEvent) => {
      if (!dragState.current || !elementRef.current) return;

      const deltaX = moveEvent.clientX - dragState.current.startX;
      const deltaY = moveEvent.clientY - dragState.current.startY;

      if (!hasDraggedRef.current && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasDraggedRef.current) {
        let finalDx = deltaX;
        let finalDy = deltaY;

        if (snapTargets?.length) {
          const parentEl = elementRef.current.parentElement;
          if (parentEl) {
            const initLeft = parseFloat(parentEl.style.left) || 0;
            const initTop = parseFloat(parentEl.style.top) || 0;
            const fieldW = parentEl.offsetWidth || 100;
            const fieldH = parentEl.offsetHeight || 12;

            const proposed: FieldRect = {
              id: field.id,
              x: initLeft + deltaX,
              y: initTop + deltaY,
              w: fieldW,
              h: fieldH,
            };

            const snap = computeSnapToGrid(proposed, snapTargets, 5);
            if (snap.x !== null) {
              finalDx = snap.x - initLeft;
            }
            if (snap.y !== null) {
              finalDy = snap.y - initTop;
            }
            onSnapGuides?.(snap.guideX, snap.guideY);
          }
        }

        dragOffsetRef.current = { x: finalDx, y: finalDy };
        elementRef.current.style.transform = `translate(${finalDx}px, ${finalDy}px)`;
      }
    };

    const handleUp = () => {
      if (onDrag && hasDraggedRef.current) {
        onDrag(dragOffsetRef.current.x, dragOffsetRef.current.y);
      }
      onSnapGuides?.(null, null);
      dragState.current = null;
      hasDraggedRef.current = false;
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

    const parentEl = elementRef.current?.parentElement;
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      handle,
      initialW: parentEl?.offsetWidth ?? 0,
      initialH: parentEl?.offsetHeight ?? 0,
      initialLeft: parseFloat(parentEl?.style.left ?? "0") || 0,
      initialTop: parseFloat(parentEl?.style.top ?? "0") || 0,
      lastDeltaX: 0,
      lastDeltaY: 0,
    };
    setIsResizing(true);

    const handleMove = (moveEvent: MouseEvent) => {
      const rs = resizeState.current;
      if (!rs || !parentEl) return;

      const deltaX = moveEvent.clientX - rs.startX;
      const deltaY = moveEvent.clientY - rs.startY;
      rs.lastDeltaX = deltaX;
      rs.lastDeltaY = deltaY;

      const minPx = 4;
      let newLeft = rs.initialLeft;
      let newTop = rs.initialTop;
      let newW = rs.initialW;
      let newH = rs.initialH;

      if (handle === "n")       { newTop = rs.initialTop + deltaY; newH = Math.max(minPx, rs.initialH - deltaY); }
      else if (handle === "e")  { newW = Math.max(minPx, rs.initialW + deltaX); }
      else if (handle === "s")  { newH = Math.max(minPx, rs.initialH + deltaY); }
      else if (handle === "w")  { newLeft = rs.initialLeft + deltaX; newW = Math.max(minPx, rs.initialW - deltaX); }
      else if (handle === "nw") { newLeft = rs.initialLeft + deltaX; newTop = rs.initialTop + deltaY; newW = Math.max(minPx, rs.initialW - deltaX); newH = Math.max(minPx, rs.initialH - deltaY); }
      else if (handle === "ne") { newTop = rs.initialTop + deltaY; newW = Math.max(minPx, rs.initialW + deltaX); newH = Math.max(minPx, rs.initialH - deltaY); }
      else if (handle === "sw") { newLeft = rs.initialLeft + deltaX; newW = Math.max(minPx, rs.initialW - deltaX); newH = Math.max(minPx, rs.initialH + deltaY); }
      else if (handle === "se") { newW = Math.max(minPx, rs.initialW + deltaX); newH = Math.max(minPx, rs.initialH + deltaY); }

      if (snapTargets?.length) {
        const snapped = snapResizeEdge(handle, newLeft, newTop, newW, newH, field.id, snapTargets, 5);
        newLeft = snapped.left;
        newTop = snapped.top;
        newW = snapped.w;
        newH = snapped.h;
        onSnapGuides?.(snapped.guideX, snapped.guideY);
      }

      parentEl.style.left = `${newLeft}px`;
      parentEl.style.top = `${newTop}px`;
      parentEl.style.width = `${newW}px`;
      parentEl.style.height = `${newH}px`;
    };

    const handleUp = () => {
      onSnapGuides?.(null, null);
      const rs = resizeState.current;
      resizeState.current = null;
      setIsResizing(false);
      if (rs && onResize) {
        onResize(rs.handle, rs.lastDeltaX, rs.lastDeltaY);
      }
      onResizeEnd?.();
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const showQuickActions = !!isSelected && !isDragging;
  const toolbarWidth = TOOLBAR_WIDTH + settingsScrollbarWidth;
  const shouldShowBaseline =
    showBaselineGuide &&
    (field.type === "text" || field.type === "signature") &&
    typeof baselineGuideOffsetPx === "number" &&
    Number.isFinite(baselineGuideOffsetPx);

  useEffect(() => {
    if (!showQuickActions) {
      setToolbarFlipLeft(false);
      return;
    }

    const adjustToolbarPosition = () => {
      const fieldEl = elementRef.current;
      if (!fieldEl) return;
      const fieldRect = fieldEl.getBoundingClientRect();
      const viewportPadding = 8;
      const wouldOverflowRight =
        fieldRect.right + toolbarWidth + 8 > window.innerWidth - viewportPadding;
      setToolbarFlipLeft(wouldOverflowRight);
    };

    const frame = window.requestAnimationFrame(adjustToolbarPosition);
    window.addEventListener("resize", adjustToolbarPosition);
    window.addEventListener("scroll", adjustToolbarPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", adjustToolbarPosition);
      window.removeEventListener("scroll", adjustToolbarPosition, true);
    };
  }, [showQuickActions, toolbarWidth, field.id, field.x, field.y, field.w, field.h]);

  useLayoutEffect(() => {
    if (!showQuickActions || !settingsContent) {
      setSettingsScrollbarWidth(0);
      return;
    }

    const scroller = settingsScrollRef.current;
    if (!scroller) return;

    const updateScrollbarWidth = () => {
      const isScrollable = scroller.scrollHeight > scroller.clientHeight + 1;
      const nextWidth = isScrollable
        ? Math.max(0, scroller.offsetWidth - scroller.clientWidth)
        : 0;
      setSettingsScrollbarWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      );
    };

    updateScrollbarWidth();

    const resizeObserver = new ResizeObserver(updateScrollbarWidth);
    resizeObserver.observe(scroller);
    Array.from(scroller.children).forEach((child) => resizeObserver.observe(child));

    const mutationObserver = new MutationObserver(updateScrollbarWidth);
    mutationObserver.observe(scroller, { childList: true, subtree: true });
    window.addEventListener("resize", updateScrollbarWidth);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateScrollbarWidth);
    };
  }, [showQuickActions, settingsContent]);

  useEffect(() => {
    if (!isSelected || !onDeselect) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (elementRef.current?.contains(target)) return;
      if (toolbarRef.current?.contains(target)) return;
      if (target.closest("[data-editor-left-panel]")) return;
      onDeselect();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isSelected, onDeselect]);

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
          className="absolute top-0 z-[60] flex flex-col overflow-hidden rounded-[0.5em] border border-slate-200/90 bg-white shadow-lg ring-1 ring-black/5"
          style={{
            width: toolbarWidth,
            left: toolbarFlipLeft ? "auto" : "calc(100% + 8px)",
            right: toolbarFlipLeft ? "calc(100% + 8px)" : "auto",
            maxHeight: "min(580px, calc(100vh - 24px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick actions row */}
          <div className="flex h-11 flex-shrink-0 items-center gap-1.5 border-b px-2">
            {signingPartyOptions.length > 0 && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-[0.33em] border border-slate-200 bg-slate-50 px-2 text-xs transition-colors hover:bg-slate-100"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span
                      className="min-w-0 flex-1 truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: selectedPartyColor }}
                    >
                      {signingPartyOptions.find((party) => party.id === field.signing_party_id)
                        ?.name || "Select recipient"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
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
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[0.33em] border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onDuplicate?.()}
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[0.33em] border border-red-200/70 bg-red-50/60 text-red-600 transition-colors hover:bg-red-50"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onDelete?.()}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <div className="inline-flex h-8 flex-shrink-0 items-center overflow-hidden rounded-[0.33em] border border-slate-200 bg-slate-50">
              <button
                type="button"
                className="hover:text-primary focus-visible:ring-primary/40 inline-flex h-8 w-7 items-center justify-center text-slate-600 transition-colors hover:bg-slate-200/80 focus-visible:ring-2 focus-visible:outline-none active:bg-slate-300/70 disabled:cursor-not-allowed disabled:opacity-40"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onPrevSameField?.()}
                title="Previous same field"
                disabled={sameFieldCount <= 1}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <div className="mb-0.5 inline-flex h-8 items-center justify-center px-1 text-sm font-semibold text-slate-700">
                {sameFieldIndex}/{sameFieldCount}
              </div>
              <button
                type="button"
                className="hover:text-primary focus-visible:ring-primary/40 inline-flex h-8 w-7 items-center justify-center text-slate-600 transition-colors hover:bg-slate-200/80 focus-visible:ring-2 focus-visible:outline-none active:bg-slate-300/70 disabled:cursor-not-allowed disabled:opacity-40"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onNextSameField?.()}
                title="Next same field"
                disabled={sameFieldCount <= 1}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Settings content */}
          {settingsContent && (
            <div
              ref={settingsScrollRef}
              className="scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0 flex-1 cursor-auto overflow-y-auto"
            >
              {settingsContent}
            </div>
          )}
        </div>
      )}

      {isSelected && (
        <>
          {(["n", "e", "s", "w"] as ResizeHandle[]).map((handle) => (
            <ResizeHandleDot
              key={handle}
              handle={handle}
              colorHex={partyColor.hex}
              onMouseDown={(e) => handleResizeStart(e, handle)}
            />
          ))}
          {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
            <ResizeHandleDot
              key={handle}
              handle={handle}
              colorHex="transparent"
              onMouseDown={(e) => handleResizeStart(e, handle)}
            />
          ))}
        </>
      )}
    </div>
  );
};
