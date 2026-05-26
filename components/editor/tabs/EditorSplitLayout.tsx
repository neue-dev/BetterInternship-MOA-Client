"use client";

import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { cn } from "@/lib/utils";
import { clampLeftPercent, useEditorViewSync } from "./editor-view-sync.context";

/**
 * Persistent header on the left column. Toggles between the field editor and the
 * form preview. Rendered outside the animated content so it stays put while the
 * panels swap; sized to match the PDF toolbar so the two column headers align.
 */
function ModeToggleBar() {
  const { activeTab, setActiveTab } = useEditorSelection();

  const buttonClass = (tab: "editor" | "preview") =>
    cn(
      "flex h-full items-center justify-center p-0 text-xs font-semibold transition-colors",
      activeTab === tab
        ? "bg-primary/15 text-primary"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
    );

  return (
    <div className="bg-card flex h-12 flex-shrink-0 items-stretch border-b">
      <div className="grid w-full grid-cols-2 bg-white">
        <button
          type="button"
          onClick={() => setActiveTab("editor")}
          className={buttonClass("editor")}
        >
          Edit Fields
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={buttonClass("preview")}
        >
          Edit Form Preview
        </button>
      </div>
    </div>
  );
}

const LEFT_TRANSITION_SECONDS = 0.35;
// The incoming panel waits this long so the outgoing one fades out first (a
// sequential swap rather than a simultaneous crossfade).
const LEFT_ENTER_DELAY_SECONDS = 0.22;
const PDF_TRANSITION_SECONDS = 0.3;
const LEFT_SLIDE_PX = 40;

/**
 * Two-column split shared by the editor and preview tabs. Both render this with
 * identical geometry (left width is the controlled, persisted `splitLeftPercent`
 * from the view-sync context), so when the tabs are stacked the panels line up.
 *
 * Animation differs per column: the left panel slides + fades between views,
 * while the PDF column only crossfades opacity and stays in place (so it never
 * appears to move or re-buffer). Dragging the divider updates the shared width,
 * so a resize in one view is reflected in the other. On mobile the split
 * collapses to a fixed-width sidebar with no draggable divider.
 */
export function EditorSplitLayout({
  side,
  left,
  right,
}: {
  side: "editor" | "preview";
  left: ReactNode;
  right: ReactNode;
}) {
  const { splitLeftPercent, setSplitLeftPercent } = useEditorViewSync();
  const { activeTab } = useEditorSelection();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const active = activeTab === side;

  const handleDividerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const applyFromClientX = (clientX: number) => {
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0) return;
        const percent = ((clientX - rect.left) / rect.width) * 100;
        setSplitLeftPercent(clampLeftPercent(percent));
      };

      const handleMove = (moveEvent: PointerEvent) => applyFromClientX(moveEvent.clientX);
      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [setSplitLeftPercent]
  );

  // The left column has a persistent toggle-bar header; only the content below
  // it animates. Swap: the outgoing panel exits left (and fades out); the
  // incoming panel enters from the left, moving right into place (and fades in).
  // Both park on the left when inactive, so the motion is the same both ways.
  const leftColumn = (className: string, style?: CSSProperties) => (
    <div className={className} style={style}>
      <ModeToggleBar />
      <motion.div
        className="min-h-0 flex-1 overflow-hidden"
        initial={false}
        animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -LEFT_SLIDE_PX }}
        transition={{
          duration: LEFT_TRANSITION_SECONDS,
          ease: active ? "easeOut" : "easeIn",
          delay: active ? LEFT_ENTER_DELAY_SECONDS : 0,
        }}
      >
        {left}
      </motion.div>
    </div>
  );

  // PDF column: opacity-only crossfade, never translates.
  const rightPanel = (
    <motion.div
      className="min-w-0 flex-1 overflow-hidden"
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: PDF_TRANSITION_SECONDS, ease: "easeOut" }}
    >
      {right}
    </motion.div>
  );

  if (isMobile) {
    return (
      <div ref={containerRef} className="flex min-h-0 flex-1">
        {leftColumn("bg-card flex flex-shrink-0 basis-72 flex-col overflow-hidden border-r")}
        {rightPanel}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      {leftColumn("bg-card flex flex-shrink-0 flex-col overflow-hidden", {
        flexBasis: `${splitLeftPercent}%`,
      })}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handleDividerPointerDown}
        className="group relative w-px flex-shrink-0 cursor-col-resize bg-border"
      >
        <div className="absolute inset-y-0 -left-1 -right-1 z-10 group-hover:bg-primary/10" />
      </div>
      {rightPanel}
    </div>
  );
}
