/**
 * @ Author: BetterInternship
 * @ Description: In-memory draft store for the create-form wizard. Mounted in the
 *   shared ft2 layout so it survives the client-side nav from create-form to the
 *   editor. This preserves the uploaded PDF `File` identity (so the editor reuses
 *   it instead of re-downloading) and drives the "Creating form..." overlay.
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { IFormSigningParty } from "@betterinternship/core/forms";

export const DEFAULT_SIGNING_PARTIES: IFormSigningParty[] = [
  { _id: "initiator", order: 1, signatory_title: "Student" },
];

interface FormDraftContextType {
  // wizard data
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  signingParties: IFormSigningParty[];
  setSigningParties: (p: IFormSigningParty[]) => void;
  formLabel: string;
  setFormLabel: (s: string) => void;
  isDebugForm: boolean;
  setIsDebugForm: (b: boolean) => void;
  formName: string | null; // slug of the form we just registered
  setFormName: (s: string | null) => void;

  // transition / overlay
  isCreating: boolean; // overlay is active (covering the screen)
  setIsCreating: (b: boolean) => void;
  editorReady: boolean; // editor finished bootstrapping behind the overlay
  markEditorReady: () => void; // editor signals load done -> overlay fades out

  clearDraft: () => void; // reset everything (wizard data + transition flags)
}

const FormDraftContext = createContext<FormDraftContextType | null>(null);

export function FormDraftProvider({ children }: { children: React.ReactNode }) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [signingParties, setSigningParties] = useState<IFormSigningParty[]>(DEFAULT_SIGNING_PARTIES);
  const [formLabel, setFormLabel] = useState("");
  const [isDebugForm, setIsDebugForm] = useState(false);
  const [formName, setFormName] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const markEditorReady = useCallback(() => setEditorReady(true), []);

  const clearDraft = useCallback(() => {
    setPdfFile(null);
    setSigningParties(DEFAULT_SIGNING_PARTIES);
    setFormLabel("");
    setIsDebugForm(false);
    setFormName(null);
    setIsCreating(false);
    setEditorReady(false);
  }, []);

  const value = useMemo<FormDraftContextType>(
    () => ({
      pdfFile,
      setPdfFile,
      signingParties,
      setSigningParties,
      formLabel,
      setFormLabel,
      isDebugForm,
      setIsDebugForm,
      formName,
      setFormName,
      isCreating,
      setIsCreating,
      editorReady,
      markEditorReady,
      clearDraft,
    }),
    [
      pdfFile,
      signingParties,
      formLabel,
      isDebugForm,
      formName,
      isCreating,
      editorReady,
      markEditorReady,
      clearDraft,
    ]
  );

  return <FormDraftContext.Provider value={value}>{children}</FormDraftContext.Provider>;
}

export function useFormDraft() {
  const ctx = useContext(FormDraftContext);
  if (!ctx) {
    throw new Error("useFormDraft must be used within a FormDraftProvider");
  }
  return ctx;
}
