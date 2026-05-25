import { useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { IFormBlock } from "@betterinternship/core/forms";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { runMissingFieldPipeline } from "@/lib/missing-fields/pipeline";
import { clamp, DEFAULT_PAGE_HEIGHT } from "./pdf-editor-utils";
import {
  ALIGNMENT_MIN_DELTA,
  ALIGNMENT_VERTICAL_TOLERANCE,
  resolveBaselineAlignmentCandidate,
} from "./baseline-alignment";

export function useBaselineAlignment({
  pdfDoc,
  blocks,
  updateBlocks,
}: {
  pdfDoc: PDFDocumentProxy | null;
  blocks: IFormBlock[];
  updateBlocks: (blocks: IFormBlock[]) => void;
}) {
  const [isBaselineAlignmentRunning, setIsBaselineAlignmentRunning] = useState(false);

  const alignNearbyFieldsToBaselines = useCallback(async () => {
    if (!pdfDoc) return;

    setIsBaselineAlignmentRunning(true);
    try {
      const suggestions = await runMissingFieldPipeline({ pdfDoc, blocks });
      if (suggestions.length <= 0) {
        toast.info("No baselines found in this PDF.", toastPresets.alert);
        return;
      }

      const pageHeights = new Map<number, number>();

      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
        const page = await pdfDoc.getPage(pageNumber);
        pageHeights.set(pageNumber, page.getViewport({ scale: 1 }).height);
      }

      let alignedCount = 0;
      const alignmentCandidates = new Map<
        string,
        ReturnType<typeof resolveBaselineAlignmentCandidate>
      >();

      for (const block of blocks) {
        const candidate = resolveBaselineAlignmentCandidate(block, suggestions);
        if (!candidate) continue;

        alignmentCandidates.set(block._id, candidate);
      }

      const nextBlocks = blocks.map((block) => {
        const schema = block.field_schema;
        if (!schema || block.block_type !== "form_field") return block;

        const candidate = alignmentCandidates.get(block._id);
        if (!candidate) return block;

        const pageHeight = pageHeights.get(schema.page) ?? DEFAULT_PAGE_HEIGHT;
        const nextY = clamp(candidate.y, 0, Math.max(0, pageHeight - schema.h));
        if (nextY <= 0 && schema.y > ALIGNMENT_VERTICAL_TOLERANCE / 2) return block;
        if (Math.abs(nextY - schema.y) < ALIGNMENT_MIN_DELTA) return block;

        alignedCount += 1;
        return {
          ...block,
          field_schema: {
            ...schema,
            y: nextY,
          },
        };
      });

      if (alignedCount <= 0) {
        toast.info("No nearby fields found to align.", toastPresets.alert);
        return;
      }

      updateBlocks(nextBlocks);
      toast.success(
        `Aligned ${alignedCount} field${alignedCount === 1 ? "" : "s"} to baselines.`,
        toastPresets.success
      );
    } catch (error) {
      console.error("Failed to align fields to baselines", error);
      toast.error("Failed to align fields to baselines.", toastPresets.destructive);
    } finally {
      setIsBaselineAlignmentRunning(false);
    }
  }, [blocks, pdfDoc, updateBlocks]);

  return { isBaselineAlignmentRunning, alignNearbyFieldsToBaselines };
}
