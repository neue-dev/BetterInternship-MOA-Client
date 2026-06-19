import { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { computePreviewBaselineOffset } from "@betterinternship/core/pdf-viewer";
import { FieldBox, type FormField } from "./FieldBox";
import { normalizeVerticalAlign } from "./pdf-editor-utils";
import { type ActiveGroupDrag } from "./use-radio-group";

export function PdfFieldLayer({
  blocks,
  pageNumber,
  scale,
  pdfToDisplay,
  selectedFieldId,
  formMetadata,
  showBaselineGuides,
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
  return (
    <div className="pointer-events-none absolute inset-0 z-10" key={containerResizeVersion}>
      {blocks.map((block) => {
        const schema = block.field_schema;
        if (!schema || schema.page !== pageNumber || block.block_type !== "form_field") return null;

        const fieldId = block._id;
        const pos = pdfToDisplay(schema.x, schema.y);
        if (!pos) return null;

        const field: FormField = {
          id: fieldId,
          field: schema.field,
          label: schema.label,
          tooltip_label: schema.tooltip_label || "",
          type: schema.type,
          page: schema.page,
          x: schema.x,
          y: schema.y,
          w: schema.w,
          h: schema.h,
          signing_party_id: block.signing_party_id,
          signing_party_order:
            formMetadata?.signing_parties?.find((p) => p._id === block.signing_party_id)?.order ??
            0,
          size: schema.size,
          font: schema.font,
          align_v: normalizeVerticalAlign(schema.align_v),
          wrap: schema.wrap,
        };

        const baselineOffsetDoc = computePreviewBaselineOffset({
          fieldType: schema.type,
          fieldFont: schema.font,
          fontSize: schema.size,
          fieldHeight: schema.h,
          alignV: normalizeVerticalAlign(schema.align_v),
        });
        const baselineOffsetPx = baselineOffsetDoc * scale;

        const sameFieldIds = findSameFieldIds(fieldId);
        const sameFieldIndex = Math.max(0, sameFieldIds.indexOf(fieldId)) + 1;

        const fieldGroupId = schema?.radio_group_id as string | undefined;
        const isGroupDragging = !!fieldGroupId && activeGroupDrag?.groupId === fieldGroupId;
        const groupDragX = isGroupDragging ? activeGroupDrag!.x : 0;
        const groupDragY = isGroupDragging ? activeGroupDrag!.y : 0;

        const isFieldSelected = selectedFieldId === fieldId;
        return (
          <div
            key={fieldId}
            data-field-id={fieldId}
            className={
              isFieldSelected
                ? "pointer-events-auto relative z-[100]"
                : "pointer-events-auto relative z-20"
            }
            style={{
              position: "absolute",
              left: `${pos.displayX}px`,
              top: `${pos.displayY}px`,
              width: `${schema.w * scale}px`,
              height: `${schema.h * scale}px`,
              transform: isGroupDragging
                ? `translate(${groupDragX}px, ${groupDragY}px)`
                : undefined,
              pointerEvents: isGroupDragging ? "none" : undefined,
            }}
          >
            <FieldBox
              field={field}
              isSelected={isFieldSelected}
              onSelect={() => {
                onFieldSelect?.(fieldId);
              }}
              onDrag={(deltaX, deltaY) => onFieldDrag(fieldId, deltaX, deltaY)}
              onDragEnd={() => {}}
              onResize={(handle, deltaX, deltaY) => onFieldResize(fieldId, handle, deltaX, deltaY)}
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
            />
          </div>
        );
      })}
    </div>
  );
}
