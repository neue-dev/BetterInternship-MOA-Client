"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import {
  formsControllerRegisterForm,
  getFormsControllerGetLatestFormDocumentAndMetadataQueryKey,
  type RegisterFormSchemaDto,
} from "@/app/api";
import { normalizeBlocksForSave } from "@/lib/form-schema-normalizer";
import {
  BLANK_FORM_METADATA,
  IFormMetadata,
  IFormBlock,
  IFormSigningParty,
  IFormSubscriber,
  SCHEMA_VERSION,
} from "@betterinternship/core/forms";

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

interface FormEditorMetadataContextType {
  // Document metadata (source of truth)
  formMetadata: IFormMetadata | null;
  setFormMetadata: (metadata: IFormMetadata) => void;
  mutateMetadata: (recipe: MetadataRecipe) => void;
  blocks: IFormBlock[];

  // Convenience metadata setters
  updateFormMetadata: (updates: Partial<IFormMetadata>) => void;
  updateBlocks: (blocks: IFormBlock[]) => void;
  updateSigningParties: (parties: IFormSigningParty[]) => void;
  updateSubscribers: (subscribers: IFormSubscriber[]) => void;

  // Fetched document + working file
  formDocument: FormDocumentDescriptor | null;
  setFormDocument: (document: FormDocumentDescriptor | null) => void;
  formVersion: number | null;
  setFormVersion: (version: number | null) => void;
  documentUrl: string | null;
  setDocumentUrl: (url: string | null) => void;
  documentFile: File | null;
  setDocumentFile: (file: File | null) => void;

  // Persistence
  isSaving: boolean;
  saveForm: () => Promise<void>;
}

const FormEditorMetadataContext = createContext<FormEditorMetadataContextType | undefined>(undefined);

export function FormEditorMetadataProvider({
  children,
  initialMetadata = BLANK_FORM_METADATA,
}: {
  children: ReactNode;
  initialMetadata?: IFormMetadata;
}) {
  const [formMetadata, setFormMetadataState] = useState<IFormMetadata | null>(initialMetadata);
  const [formDocument, setFormDocument] = useState<FormDocumentDescriptor | null>(null);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setFormMetadata = useCallback((metadata: IFormMetadata) => {
    setFormMetadataState(metadata);
  }, []);

  // Apply a pure operation to the current metadata. Skips when no document is loaded.
  const mutateMetadata = useCallback((recipe: MetadataRecipe) => {
    setFormMetadataState((prev) => (prev ? recipe(prev) : prev));
  }, []);

  const blocks = useMemo(() => formMetadata?.schema.blocks || [], [formMetadata]);

  const updateFormMetadata = useCallback((updates: Partial<IFormMetadata>) => {
    setFormMetadataState((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const updateBlocks = useCallback((nextBlocks: IFormBlock[]) => {
    setFormMetadataState((prev) =>
      prev ? { ...prev, schema: { ...prev.schema, blocks: nextBlocks } } : prev
    );
  }, []);

  const updateSigningParties = useCallback((parties: IFormSigningParty[]) => {
    setFormMetadataState((prev) => (prev ? { ...prev, signing_parties: parties } : prev));
  }, []);

  const updateSubscribers = useCallback((subscribers: IFormSubscriber[]) => {
    setFormMetadataState((prev) => (prev ? { ...prev, subscribers } : prev));
  }, []);

  const queryClient = useQueryClient();

  // Normalization happens here, at the persistence boundary, instead of on every
  // in-memory edit.
  const saveForm = useCallback(async () => {
    if (!formMetadata) return;
    setIsSaving(true);
    try {
      const normalizedMetadata: IFormMetadata = {
        ...formMetadata,
        schema_version: SCHEMA_VERSION,
        schema: {
          ...formMetadata.schema,
          blocks: normalizeBlocksForSave(formMetadata.schema.blocks),
        },
      };

      const payload: RegisterFormSchemaDto = {
        ...(normalizedMetadata as unknown as RegisterFormSchemaDto),
        base_document: documentFile ?? undefined,
      };

      await formsControllerRegisterForm(payload);
      queryClient.invalidateQueries({ queryKey: ["docs-forms-names"] });
      queryClient.invalidateQueries({
        queryKey: getFormsControllerGetLatestFormDocumentAndMetadataQueryKey({
          name: formMetadata.name,
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
  }, [formMetadata, documentFile, queryClient]);

  const value: FormEditorMetadataContextType = useMemo(
    () => ({
      formMetadata,
      setFormMetadata,
      mutateMetadata,
      blocks,
      updateFormMetadata,
      updateBlocks,
      updateSigningParties,
      updateSubscribers,
      formDocument,
      setFormDocument,
      formVersion,
      setFormVersion,
      documentUrl,
      setDocumentUrl,
      documentFile,
      setDocumentFile,
      isSaving,
      saveForm,
    }),
    [
      formMetadata,
      setFormMetadata,
      mutateMetadata,
      blocks,
      updateFormMetadata,
      updateBlocks,
      updateSigningParties,
      updateSubscribers,
      formDocument,
      formVersion,
      documentUrl,
      documentFile,
      isSaving,
      saveForm,
    ]
  );

  return <FormEditorMetadataContext.Provider value={value}>{children}</FormEditorMetadataContext.Provider>;
}

export function useFormEditorMetadata() {
  const context = useContext(FormEditorMetadataContext);
  if (!context) {
    throw new Error("useFormEditorMetadata must be used within FormEditorMetadataProvider");
  }
  return context;
}
