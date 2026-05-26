"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorPdfViewer } from "@/app/contexts/pdf-viewer.context";

interface EditorViewSyncContextType {
  // Shared left-column width (percent) for the editor/preview split. Both views
  // read this so the PDF panel sits in the exact same box and a resize in one
  // view applies to the other, keeping the crossfade aligned. Persisted to
  // localStorage.
  splitLeftPercent: number;
  setSplitLeftPercent: (percent: number) => void;
  // Register each view's PDF scroll container so we can copy scroll position
  // across when toggling editor <-> preview.
  registerEditorScroller: (el: HTMLElement | null) => void;
  registerPreviewScroller: (el: HTMLElement | null) => void;
  // Zoom sync: the preview reads `previewScale` as its (commanded) zoom and
  // reports its current zoom back via `reportPreviewScale` so we can copy it to
  // the editor on switch. The editor's zoom lives in the pdf-viewer context.
  previewScale: number | undefined;
  reportPreviewScale: (scale: number) => void;
}

const EditorViewSyncContext = createContext<EditorViewSyncContextType | undefined>(undefined);

const MIN_LEFT_PERCENT = 24;
const MAX_LEFT_PERCENT = 60;
const DEFAULT_LEFT_PERCENT = 30;
const SPLIT_STORAGE_KEY = "form-editor:pdf-split-left-percent";

export const clampLeftPercent = (percent: number) =>
  Math.min(MAX_LEFT_PERCENT, Math.max(MIN_LEFT_PERCENT, percent));

const readStoredSplit = (): number => {
  if (typeof window === "undefined") return DEFAULT_LEFT_PERCENT;
  const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? clampLeftPercent(parsed) : DEFAULT_LEFT_PERCENT;
};

/**
 * Shared layout/scroll/zoom coordination for the editor and preview tabs, which
 * are mounted together and crossfaded. Holds the controlled (persisted) split
 * width, the two PDF scrollers, and the preview zoom; on each editor <-> preview
 * toggle it copies the outgoing panel's scroll position and zoom to the incoming
 * one so the views appear continuous.
 */
export function EditorViewSyncProvider({ children }: { children: ReactNode }) {
  const { activeTab } = useEditorSelection();
  const { scale: editorScale, setScale: setEditorScale } = useFormEditorPdfViewer();

  const [splitLeftPercent, setSplitLeftPercentState] = useState<number>(readStoredSplit);
  // Commanded preview zoom (applied to the preview PDF as its `scale` prop).
  const [previewScale, setPreviewScale] = useState<number | undefined>(undefined);

  const editorScrollerRef = useRef<HTMLElement | null>(null);
  const previewScrollerRef = useRef<HTMLElement | null>(null);
  const previewScaleRef = useRef<number | null>(null);
  const editorScaleRef = useRef(editorScale);
  const setEditorScaleRef = useRef(setEditorScale);
  const prevTabRef = useRef(activeTab);
  editorScaleRef.current = editorScale;
  setEditorScaleRef.current = setEditorScale;

  // Persist the split width.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitLeftPercent));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [splitLeftPercent]);

  // On editor <-> preview switch, copy scroll position and zoom to the incoming panel.
  useEffect(() => {
    const prevTab = prevTabRef.current;
    prevTabRef.current = activeTab;

    const isPairTab = (tab: string) => tab === "editor" || tab === "preview";
    if (prevTab === activeTab || !isPairTab(prevTab) || !isPairTab(activeTab)) return;

    // Zoom: copy the outgoing panel's zoom to the incoming one.
    if (prevTab === "editor" && activeTab === "preview") {
      setPreviewScale(editorScaleRef.current);
    } else if (prevTab === "preview" && activeTab === "editor") {
      if (previewScaleRef.current != null) setEditorScaleRef.current(previewScaleRef.current);
    }

    // Scroll: copy proportional position.
    const from = prevTab === "editor" ? editorScrollerRef.current : previewScrollerRef.current;
    const to = activeTab === "editor" ? editorScrollerRef.current : previewScrollerRef.current;
    if (!from || !to) return;

    const fromMax = Math.max(1, from.scrollHeight - from.clientHeight);
    const fraction = from.scrollTop / fromMax;
    const frameId = window.requestAnimationFrame(() => {
      const toMax = Math.max(0, to.scrollHeight - to.clientHeight);
      to.scrollTop = fraction * toMax;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab]);

  const setSplitLeftPercent = useCallback(
    (percent: number) => setSplitLeftPercentState(clampLeftPercent(percent)),
    []
  );
  const registerEditorScroller = useCallback((el: HTMLElement | null) => {
    editorScrollerRef.current = el;
  }, []);
  const registerPreviewScroller = useCallback((el: HTMLElement | null) => {
    previewScrollerRef.current = el;
  }, []);
  const reportPreviewScale = useCallback((scale: number) => {
    previewScaleRef.current = scale;
  }, []);

  const value = useMemo<EditorViewSyncContextType>(
    () => ({
      splitLeftPercent,
      setSplitLeftPercent,
      registerEditorScroller,
      registerPreviewScroller,
      previewScale,
      reportPreviewScale,
    }),
    [
      splitLeftPercent,
      setSplitLeftPercent,
      registerEditorScroller,
      registerPreviewScroller,
      previewScale,
      reportPreviewScale,
    ]
  );

  return <EditorViewSyncContext.Provider value={value}>{children}</EditorViewSyncContext.Provider>;
}

/**
 * Returns the shared view-sync controls. Safe to call outside the provider
 * (e.g. when a PDF panel is reused elsewhere) — it falls back to no-ops so those
 * usages are unaffected.
 */
export function useEditorViewSync(): EditorViewSyncContextType {
  const context = useContext(EditorViewSyncContext);
  if (!context) {
    return {
      splitLeftPercent: DEFAULT_LEFT_PERCENT,
      setSplitLeftPercent: () => {},
      registerEditorScroller: () => {},
      registerPreviewScroller: () => {},
      previewScale: undefined,
      reportPreviewScale: () => {},
    };
  }
  return context;
}
