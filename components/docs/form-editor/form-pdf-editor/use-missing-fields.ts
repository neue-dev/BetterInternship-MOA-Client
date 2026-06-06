import { RefObject, useCallback, useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { FieldRegistryEntryDetails } from "@/app/api";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import {
  runMissingFieldPipeline,
  type MissingFieldSuggestion,
} from "@/lib/missing-fields/pipeline";
import { createBlockFromSuggestionWithPreset } from "@/lib/missing-fields/presets";
import { classifyBlankRegionsAgainstBlocks } from "@/lib/missing-fields/compare";
import { toExistingFieldRects } from "@/lib/missing-fields/types";
import { type ResolvedSystemPresetTemplate } from "@/lib/system-preset-resolver";
import { type BlockGroup } from "@/lib/form-editor-metadata";

export function useMissingFields({
  pdfDoc,
  blocks,
  selectedFieldId,
  selectedPartyId,
  formMetadata,
  resolvedSystemPresets,
  fieldRegistryDetails,
  pageRefs,
  pendingMissingFieldDraft,
  setPendingMissingFieldDraft,
  setSelectedBlockId,
  setSelectedBlockGroup,
  setVisiblePage,
}: {
  pdfDoc: PDFDocumentProxy | null;
  blocks: IFormBlock[];
  selectedFieldId: string | null;
  selectedPartyId: string | null;
  formMetadata: IFormMetadata | null;
  resolvedSystemPresets: ResolvedSystemPresetTemplate[];
  fieldRegistryDetails: FieldRegistryEntryDetails[];
  pageRefs: RefObject<Map<number, HTMLDivElement | null>>;
  pendingMissingFieldDraft: IFormBlock | null;
  setPendingMissingFieldDraft: (block: IFormBlock | null) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  setSelectedBlockGroup: (group: BlockGroup | null) => void;
  setVisiblePage: (page: number) => void;
}) {
  const [showMissingFieldSuggestions, setShowMissingFieldSuggestions] = useState(false);
  const [isMissingFieldScanRunning, setIsMissingFieldScanRunning] = useState(false);
  const [missingFieldSuggestions, setMissingFieldSuggestions] = useState<MissingFieldSuggestion[]>(
    []
  );
  const [selectedMissingSuggestionId, setSelectedMissingSuggestionId] = useState<string | null>(
    null
  );

  const visibleMissingSuggestions = useMemo(() => {
    const mappedFieldRects = toExistingFieldRects(blocks);
    const reclassified = classifyBlankRegionsAgainstBlocks(
      missingFieldSuggestions,
      mappedFieldRects
    );
    return reclassified.filter((suggestion) => suggestion.classification === "missing");
  }, [blocks, missingFieldSuggestions]);

  useEffect(() => {
    if (pendingMissingFieldDraft) return;
    if (!selectedMissingSuggestionId) return;
    const stillVisible = visibleMissingSuggestions.some(
      (suggestion) => suggestion.id === selectedMissingSuggestionId
    );
    if (!stillVisible) {
      setSelectedMissingSuggestionId(null);
    }
  }, [pendingMissingFieldDraft, selectedMissingSuggestionId, visibleMissingSuggestions]);

  const runMissingFieldScan = useCallback(async () => {
    if (!pdfDoc) return;

    setIsMissingFieldScanRunning(true);
    try {
      const suggestions = await runMissingFieldPipeline({ pdfDoc, blocks });
      setMissingFieldSuggestions(suggestions);
      setSelectedMissingSuggestionId(
        suggestions.find((suggestion) => suggestion.classification === "missing")?.id || null
      );
      setShowMissingFieldSuggestions(true);
      setPendingMissingFieldDraft(null);
    } catch (error) {
      console.error("Failed to scan for missing fields", error);
      toast.error("Failed to scan PDF for missing fields.", toastPresets.destructive);
    } finally {
      setIsMissingFieldScanRunning(false);
    }
  }, [blocks, pdfDoc, setPendingMissingFieldDraft]);

  const selectSuggestionDraft = useCallback(
    (suggestionId: string) => {
      const target = visibleMissingSuggestions.find((suggestion) => suggestion.id === suggestionId);
      if (!target) return;

      const nextPartyId = selectedPartyId || formMetadata?.signing_parties?.[0]?._id || "";
      if (!nextPartyId) {
        toast.error(
          "Please add a recipient before accepting suggested fields.",
          toastPresets.alert
        );
        return;
      }

      setSelectedMissingSuggestionId(target.id);
      setVisiblePage(target.page);
      const pageNode = pageRefs.current.get(target.page);
      pageNode?.scrollIntoView({ behavior: "smooth", block: "center" });

      const draftBlock = createBlockFromSuggestionWithPreset({
        suggestion: target,
        signingPartyId: nextPartyId,
        presets: resolvedSystemPresets,
        registryFields: fieldRegistryDetails,
      });
      setPendingMissingFieldDraft(draftBlock);
      setSelectedBlockId(draftBlock._id);
      setSelectedBlockGroup(null);
    },
    [
      formMetadata?.signing_parties,
      resolvedSystemPresets,
      selectedPartyId,
      setPendingMissingFieldDraft,
      setSelectedBlockGroup,
      setSelectedBlockId,
      setVisiblePage,
      fieldRegistryDetails,
      visibleMissingSuggestions,
      pageRefs,
    ]
  );

  const clearMissingFieldSuggestions = useCallback(() => {
    setShowMissingFieldSuggestions(false);
    setMissingFieldSuggestions([]);
    setSelectedMissingSuggestionId(null);

    if (pendingMissingFieldDraft) {
      if (selectedFieldId === pendingMissingFieldDraft._id) {
        setSelectedBlockId(null);
      }
      setPendingMissingFieldDraft(null);
    }
  }, [pendingMissingFieldDraft, selectedFieldId, setPendingMissingFieldDraft, setSelectedBlockId]);

  return {
    showMissingFieldSuggestions,
    isMissingFieldScanRunning,
    visibleMissingSuggestions,
    selectedMissingSuggestionId,
    runMissingFieldScan,
    selectSuggestionDraft,
    clearMissingFieldSuggestions,
  };
}
