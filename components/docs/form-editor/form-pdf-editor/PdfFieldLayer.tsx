import { useCallback, useMemo, useRef } from "react";
import { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { computePreviewBaselineOffset } from "@betterinternship/core/pdf-viewer";
import { FieldBox, type FormField } from "./FieldBox";
import { normalizeVerticalAlign } from "./pdf-editor-utils";
import { type ActiveGroupDrag } from "./use-radio-group";
import { computeSnapToGrid, type FieldRect } from "@/lib/snap-to-grid";
import type { RepeatedPdfField } from "@/lib/repeated-pdf-fields";

export function PdfFieldLayer({
  blocks,
  pageNumber,
  scale,
  pdfToDisplay,
  selectedFieldId,
  formMetadata,
  showBaselineGuides,
  snapToGridEnabled = true,
  containerResizeVersion,
  activeGroupDrag,
  findSameFieldIds,
  onFieldSelect,
  onFieldDrag,
  onFieldResize,
  onFieldRecipientChange,
  onDeleteBlock,
  onDuplicateField,
  onSelectPrevSameField,
  onSelectNextSameField,
  onClearSelection,
}: {
  blocks: IFormBlock[];
  pageNumber: number;
  scale: number;
  pdfToDisplay: (pdfX: number, pdfY: number) => { displayX: number; displayY: number } | null;
  selectedFieldId: string | null | undefined;
  formMetadata: IFormMetadata | null;
  showBaselineGuides: boolean;
  snapToGridEnabled?: boolean;
  containerResizeVersion: number;
  activeGroupDrag: ActiveGroupDrag;
  findSameFieldIds: (fieldId: string) => string[];
  onFieldSelect: (fieldId: string) => void;
  onFieldDrag: (fieldId: string, displayDeltaX: number, displayDeltaY: number) => void;
  onFieldResize: (
    fieldId: string,
    handle: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
    displayDeltaX: number,
    displayDeltaY: number
  ) => void;
  onFieldRecipientChange: (fieldId: string, partyId: string) => void;
  onDeleteBlock: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  onSelectPrevSameField: (fieldId: string) => void;
  onSelectNextSameField: (fieldId: string) => void;
  onClearSelection: () => void;
}) {
  const guidesRef = useRef<HTMLDivElement>(null);

  const handleSnapGuides = useCallback((guideX: number | null, guideY: number | null) => {
    const el = guidesRef.current;
    if (!el || el.children.length < 2) return;
    const vGuide = el.children[0] as HTMLElement;
    const hGuide = el.children[1] as HTMLElement;
    if (guideX != null) {
      vGuide.style.display = "block";
      vGuide.style.left = `${guideX}px`;
    } else {
      vGuide.style.display = "none";
    }
    if (guideY != null) {
      hGuide.style.display = "block";
      hGuide.style.top = `${guideY}px`;
    } else {
      hGuide.style.display = "none";
    }
  }, []);

  const snapTargets = useMemo<FieldRect[]>(() => {
    if (!snapToGridEnabled) return [];
    const rects: FieldRect[] = [];
    for (const b of blocks) {
      if (b.block_type !== "form_field" || !b.field_schema || b.field_schema.page !== pageNumber)
        continue;
      const pos = pdfToDisplay(b.field_schema.x, b.field_schema.y);
      if (!pos) continue;
      rects.push({
        id: b._id,
        x: pos.displayX,
        y: pos.displayY,
        w: b.field_schema.w * scale,
        h: b.field_schema.h * scale,
      });
    }
    return rects;
  }, [blocks, pageNumber, scale, pdfToDisplay, snapToGridEnabled]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" key={containerResizeVersion}>
      <div ref={guidesRef} className="pointer-events-none absolute inset-0 z-[200]">
        <div className="absolute top-0 hidden h-full w-[2px] bg-[#0099FF] shadow-[0_0_8px_rgba(0,153,255,0.7)]" />
        <div className="absolute left-0 hidden h-[2px] w-full bg-[#0099FF] shadow-[0_0_8px_rgba(0,153,255,0.7)]" />
      </div>
      {blocks.flatMap((block) => {
        const schema = block.field_schema;
        if (!schema || schema.page !== pageNumber || block.block_type !== "form_field") return null;

        const fieldId = block._id;
        const repeat = (schema as typeof schema & { repeat?: RepeatedPdfField }).repeat;
        // The editor has no form values to resolve a visible-count field, so it
        // shows the full configured capacity as placement guides.
        const repeatCount = repeat ? Math.max(1, Math.floor(repeat.count || 0)) : 1;

        return Array.from({ length: repeatCount }, (_, repeatIndex) => {
          const isRepeatedCopy = repeatIndex > 0;
          const displayFieldId = isRepeatedCopy ? `${fieldId}:repeat:${repeatIndex}` : fieldId;
          const displaySchema = isRepeatedCopy
            ? {
                ...schema,
                x: schema.x + (repeat?.offset_x ?? 0) * repeatIndex,
                y: schema.y + (repeat?.offset_y ?? 0) * repeatIndex,
              }
            : schema;
          const pos = pdfToDisplay(displaySchema.x, displaySchema.y);
          if (!pos) return null;

          const field: FormField = {
            id: displayFieldId,
            field: displaySchema.field,
            label: displaySchema.label,
            tooltip_label: displaySchema.tooltip_label || "",
            type: displaySchema.type,
            page: displaySchema.page,
            x: displaySchema.x,
            y: displaySchema.y,
            w: displaySchema.w,
            h: displaySchema.h,
            signing_party_id: block.signing_party_id,
            signing_party_order:
              formMetadata?.signing_parties?.find((p) => p._id === block.signing_party_id)?.order ??
              0,
            size: displaySchema.size,
            font: displaySchema.font,
            align_v: normalizeVerticalAlign(displaySchema.align_v),
            wrap: displaySchema.wrap,
          };

          const baselineOffsetDoc = computePreviewBaselineOffset({
            fieldType: displaySchema.type,
            fieldFont: displaySchema.font,
            fontSize: displaySchema.size,
            fieldHeight: displaySchema.h,
            alignV: normalizeVerticalAlign(displaySchema.align_v),
          });
          const baselineOffsetPx = baselineOffsetDoc * scale;

          const sameFieldIds = findSameFieldIds(fieldId);
          const sameFieldIndex = Math.max(0, sameFieldIds.indexOf(fieldId)) + 1;

          const fieldGroupId = schema.radio_group_id as string | undefined;
          const isGroupDragging = !!fieldGroupId && activeGroupDrag?.groupId === fieldGroupId;
          const groupDragX = isGroupDragging ? activeGroupDrag!.x : 0;
          const groupDragY = isGroupDragging ? activeGroupDrag!.y : 0;
          const isFieldSelected = selectedFieldId === fieldId && !isRepeatedCopy;

          return (
            <div
              key={displayFieldId}
              data-field-id={displayFieldId}
              className={
                isFieldSelected
                  ? "pointer-events-auto relative z-[100]"
                  : isRepeatedCopy
                    ? "pointer-events-none relative z-20"
                    : "pointer-events-auto relative z-20"
              }
              style={{
                position: "absolute",
                left: `${pos.displayX}px`,
                top: `${pos.displayY}px`,
                width: `${displaySchema.w * scale}px`,
                height: `${displaySchema.h * scale}px`,
                transform: isGroupDragging
                  ? `translate(${groupDragX}px, ${groupDragY}px)`
                  : undefined,
                pointerEvents: isGroupDragging || isRepeatedCopy ? "none" : undefined,
                opacity: isRepeatedCopy ? 0.45 : undefined,
              }}
            >
              <FieldBox
                field={field}
                isSelected={isFieldSelected}
                onSelect={() => onFieldSelect(fieldId)}
                onDrag={(deltaX, deltaY) => onFieldDrag(fieldId, deltaX, deltaY)}
                onDragEnd={() => {}}
                onResize={(handle, deltaX, deltaY) =>
                  onFieldResize(fieldId, handle, deltaX, deltaY)
                }
                onResizeEnd={() => {}}
                signingPartyOptions={(formMetadata?.signing_parties || []).map((party) => ({
                  id: party._id,
                  name: party.signatory_title || party._id,
                }))}
                onSigningPartyChange={(partyId) => onFieldRecipientChange(fieldId, partyId)}
                onDelete={() => onDeleteBlock(fieldId)}
                onDuplicate={() => onDuplicateField(fieldId)}
                sameFieldIndex={sameFieldIndex}
                sameFieldCount={sameFieldIds.length}
                onPrevSameField={() => onSelectPrevSameField(fieldId)}
                onNextSameField={() => onSelectNextSameField(fieldId)}
                showBaselineGuide={showBaselineGuides}
                baselineGuideOffsetPx={baselineOffsetPx}
                showInlineDelete={!!schema.radio_group_id}
                onInlineDelete={() => onDeleteBlock(fieldId)}
                onDeselect={onClearSelection}
                snapTargets={snapTargets}
                onSnapGuides={handleSnapGuides}
              />
            </div>
          );
        });
      })}
    </div>
  );
}
