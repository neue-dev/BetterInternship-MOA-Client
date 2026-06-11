"use client";

import {
  createContext,
  useContext,
  useReducer,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastPresets, showCompactToast } from "@/components/sonner-toaster";
import { Undo2, Redo2 } from "lucide-react";
import {
  formsControllerRegisterForm,
  getFormsControllerGetLatestFormDocumentAndMetadataQueryKey,
  type RegisterFormSchemaDto,
} from "@/app/api";
import { normalizeBlocksForSave } from "@/lib/form-schema-normalizer";
import {
  computeDelta,
  applyDelta,
  mergeDeltas,
  diffFormMetadata,
} from "@/lib/form-editor-metadata/diff";
import type { Delta, FormMetadataDiff } from "@/lib/form-editor-metadata/diff";
import {
  BLANK_FORM_METADATA,
  IFormMetadata,
  IFormBlock,
  IFormSigningParty,
  IFormSubscriber,
  SCHEMA_VERSION,
} from "@betterinternship/core/forms";
import { usePdfDocumentFromFile } from "@betterinternship/core/pdf-viewer";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

/**
 * Owns the form editor metadata: the metadata source of truth, the fetched
 * document descriptor, the working PDF file, and persistence. Block edits are
 * expressed as pure operations from `@/lib/form-editor-metadata` applied via
 * `mutateMetadata`.
 */
export interface FormDocumentDescriptor {
  name: string;
  label: string;
  version: number;
  base_document_id: string;
  time_generated: string;
}

type MetadataRecipe = (prev: IFormMetadata) => IFormMetadata;

// ---- Reducer ----

const MAX_HISTORY = 127;
const MERGE_WINDOW_MS = 2000;

type ReducerState = {
  present: IFormMetadata;
  past: Delta[];
  future: Delta[];
  baseline: IFormMetadata;
};

type ReducerAction =
  | { type: "LOAD"; payload: IFormMetadata }
  | { type: "COMMIT"; payload: IFormMetadata; mergeKey?: string }
  | { type: "MUTATE"; recipe: MetadataRecipe; mergeKey?: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" };

function normalizeMetadataForSave(metadata: IFormMetadata): IFormMetadata {
  return {
    ...metadata,
    schema_version: SCHEMA_VERSION,
    schema: { ...metadata.schema, blocks: normalizeBlocksForSave(metadata.schema.blocks) },
  };
}

function pushDelta(
  state: ReducerState,
  delta: Delta,
  mergeKey: string | undefined,
  nextPresent: IFormMetadata
): ReducerState {
  const now = Date.now();
  const deltaWithMeta: Delta = { ...delta, mergeKey, timestamp: now };
  const past = state.past;
  const lastDelta = past[past.length - 1];

  if (
    mergeKey &&
    lastDelta &&
    lastDelta.mergeKey === mergeKey &&
    now - (lastDelta.timestamp ?? 0) < MERGE_WINDOW_MS
  ) {
    const merged = mergeDeltas(lastDelta, deltaWithMeta);
    return { ...state, present: nextPresent, past: [...past.slice(0, -1), merged], future: [] };
  }

  const newPast =
    past.length >= MAX_HISTORY
      ? [...past.slice(1), deltaWithMeta]
      : [...past, deltaWithMeta];
  return { ...state, present: nextPresent, past: newPast, future: [] };
}

function metadataReducer(state: ReducerState, action: ReducerAction): ReducerState {
  switch (action.type) {
    case "LOAD":
      return { present: action.payload, past: [], future: [], baseline: action.payload };

    case "COMMIT": {
      const next = action.payload;
      const delta = computeDelta(state.present, next);
      if (!delta) return { ...state, present: next };
      return pushDelta(state, delta, action.mergeKey, next);
    }

    case "MUTATE": {
      const next = action.recipe(state.present);
      const delta = computeDelta(state.present, next);
      if (!delta) return { ...state, present: next };
      return pushDelta(state, delta, action.mergeKey, next);
    }

    case "UNDO": {
      if (!state.past.length) return state;
      const past = [...state.past];
      const d = past.pop()!;
      return {
        ...state,
        present: applyDelta(state.present, d, "undo"),
        past,
        future: [d, ...state.future],
      };
    }

    case "REDO": {
      if (!state.future.length) return state;
      const future = [...state.future];
      const d = future.shift()!;
      return {
        ...state,
        present: applyDelta(state.present, d, "redo"),
        past: [...state.past, d],
        future,
      };
    }

    case "MARK_SAVED":
      return { ...state, baseline: normalizeMetadataForSave(state.present) };

    default:
      return state;
  }
}

// ---- Context type ----

interface FormEditorMetadataContextType {
  // Document metadata (source of truth)
  formMetadata: IFormMetadata | null;
  /** Load fresh document — resets history and baseline. Use for initial bootstrap. */
  loadFormMetadata: (metadata: IFormMetadata) => void;
  /** Record an undoable edit. Use for all user-initiated changes. */
  setFormMetadata: (metadata: IFormMetadata) => void;
  mutateMetadata: (recipe: MetadataRecipe, mergeKey?: string) => void;
  blocks: IFormBlock[];

  // Convenience metadata setters
  updateFormMetadata: (updates: Partial<IFormMetadata>) => void;
  updateBlocks: (blocks: IFormBlock[]) => void;
  updateSigningParties: (parties: IFormSigningParty[]) => void;
  updateSubscribers: (subscribers: IFormSubscriber[]) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Net diff between last save/load (baseline) and current state. Memoized. */
  pendingDiff: FormMetadataDiff;

  // Fetched document + working file
  formDocument: FormDocumentDescriptor | null;
  setFormDocument: (document: FormDocumentDescriptor | null) => void;
  formVersion: number | null;
  setFormVersion: (version: number | null) => void;
  documentUrl: string | null;
  setDocumentUrl: (url: string | null) => void;
  documentFile: File | null;
  setDocumentFile: (file: File | null) => void;
  /** True when the user has replaced the base document since the last save. */
  documentFileReplaced: boolean;
  replaceDocumentFile: (file: File | null) => void;

  // PDF document (loaded from documentFile via pdfjs)
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  isPdfLoading: boolean;
  pdfError: string | null;

  // Persistence
  isSaving: boolean;
  saveForm: () => Promise<void>;
  /** Call after a successful save to reset the diff baseline. */
  markSaved: () => void;
}

const FormEditorMetadataContext = createContext<FormEditorMetadataContextType | undefined>(
  undefined
);

export function FormEditorMetadataProvider({
  children,
  initialMetadata = BLANK_FORM_METADATA,
}: {
  children: ReactNode;
  initialMetadata?: IFormMetadata;
}) {
  const [state, dispatch] = useReducer(metadataReducer, {
    present: initialMetadata,
    past: [],
    future: [],
    baseline: initialMetadata,
  });

  const [formDocument, setFormDocument] = useState<FormDocumentDescriptor | null>(null);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileReplaced, setDocumentFileReplaced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // PDF document loaded from documentFile — exposed so editor page + PDF viewer
  // share the same pdfjs instance during initial load.
  const { pdfDoc, pageCount, isLoading: isPdfLoading, error: pdfError } =
    usePdfDocumentFromFile(documentFile);

  const loadFormMetadata = useCallback((metadata: IFormMetadata) => {
    dispatch({ type: "LOAD", payload: metadata });
  }, []);

  const setFormMetadata = useCallback((metadata: IFormMetadata) => {
    dispatch({ type: "COMMIT", payload: metadata });
  }, []);

  const mutateMetadata = useCallback((recipe: MetadataRecipe, mergeKey?: string) => {
    dispatch({ type: "MUTATE", recipe, mergeKey });
  }, []);

  const updateFormMetadata = useCallback((updates: Partial<IFormMetadata>) => {
    dispatch({ type: "MUTATE", recipe: (prev) => ({ ...prev, ...updates }) });
  }, []);

  const updateBlocks = useCallback((nextBlocks: IFormBlock[]) => {
    dispatch({
      type: "MUTATE",
      recipe: (prev) => ({ ...prev, schema: { ...prev.schema, blocks: nextBlocks } }),
    });
  }, []);

  const updateSigningParties = useCallback((parties: IFormSigningParty[]) => {
    dispatch({ type: "MUTATE", recipe: (prev) => ({ ...prev, signing_parties: parties }) });
  }, []);

  const updateSubscribers = useCallback((subscribers: IFormSubscriber[]) => {
    dispatch({ type: "MUTATE", recipe: (prev) => ({ ...prev, subscribers }) });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
    showCompactToast("Undo", <Undo2 className="h-4 w-4" />);
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
    showCompactToast("Redo", <Redo2 className="h-4 w-4" />);
  }, []);

  const markSaved = useCallback(() => {
    dispatch({ type: "MARK_SAVED" });
    setDocumentFileReplaced(false);
  }, []);

  const replaceDocumentFile = useCallback((file: File | null) => {
    setDocumentFile(file);
    setDocumentFileReplaced(true);
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const pendingDiff = useMemo(
    () => diffFormMetadata(state.baseline, state.present),
    [state.baseline, state.present]
  );

  const blocks = useMemo(() => state.present?.schema.blocks || [], [state.present]);

  const queryClient = useQueryClient();

  // Normalization happens here, at the persistence boundary.
  const saveForm = useCallback(async () => {
    if (!state.present) return;
    setIsSaving(true);
    try {
      const normalizedMetadata = normalizeMetadataForSave(state.present);
      const payload: RegisterFormSchemaDto = {
        ...(normalizedMetadata as unknown as RegisterFormSchemaDto),
        base_document: documentFile ?? undefined,
      };

      await formsControllerRegisterForm(payload);
      queryClient.invalidateQueries({ queryKey: ["docs-forms-names"] });
      queryClient.invalidateQueries({
        queryKey: getFormsControllerGetLatestFormDocumentAndMetadataQueryKey({
          name: state.present.name,
        }),
        refetchType: "inactive",
      });
      toast.success("Form saved successfully!", toastPresets.success);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save form", toastPresets.destructive);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [state.present, documentFile, queryClient]);

  const value: FormEditorMetadataContextType = useMemo(
    () => ({
      formMetadata: state.present,
      loadFormMetadata,
      setFormMetadata,
      mutateMetadata,
      blocks,
      updateFormMetadata,
      updateBlocks,
      updateSigningParties,
      updateSubscribers,
      undo,
      redo,
      canUndo,
      canRedo,
      pendingDiff,
      formDocument,
      setFormDocument,
      formVersion,
      setFormVersion,
      documentUrl,
      setDocumentUrl,
      documentFile,
      setDocumentFile,
      documentFileReplaced,
      replaceDocumentFile,
      pdfDoc,
      pageCount,
      isPdfLoading,
      pdfError,
      isSaving,
      saveForm,
      markSaved,
    }),
    [
      state.present,
      loadFormMetadata,
      setFormMetadata,
      mutateMetadata,
      blocks,
      updateFormMetadata,
      updateBlocks,
      updateSigningParties,
      updateSubscribers,
      undo,
      redo,
      canUndo,
      canRedo,
      pendingDiff,
      formDocument,
      formVersion,
      documentUrl,
      documentFile,
      documentFileReplaced,
      replaceDocumentFile,
      pdfDoc,
      pageCount,
      isPdfLoading,
      pdfError,
      isSaving,
      saveForm,
      markSaved,
    ]
  );

  return (
    <FormEditorMetadataContext.Provider value={value}>
      {children}
    </FormEditorMetadataContext.Provider>
  );
}

export function useFormEditorMetadata() {
  const context = useContext(FormEditorMetadataContext);
  if (!context) {
    throw new Error("useFormEditorMetadata must be used within FormEditorMetadataProvider");
  }
  return context;
}
