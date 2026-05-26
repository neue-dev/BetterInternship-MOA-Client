"use client";

import { useState } from "react";
import { ChevronRight, Save } from "lucide-react";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BlockChange, FieldDelta, ListChange } from "@/lib/form-editor-metadata/diff";

interface SaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KindBadge({ kind }: { kind: "added" | "removed" | "modified" }) {
  if (kind === "added") return <span className="font-medium text-green-600">+ Added</span>;
  if (kind === "removed") return <span className="font-medium text-red-600">− Removed</span>;
  return <span className="font-medium text-blue-600">~ Modified</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <div className="space-y-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function FieldDeltaRow({ delta }: { delta: FieldDelta }) {
  const [open, setOpen] = useState(false);

  if (delta.children?.length) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
          />
          {delta.label}
        </button>
        {open && (
          <div className="pl-4 pt-0.5 space-y-0.5">
            {delta.children.map((child) => (
              <div key={child.key} className="text-xs text-muted-foreground">
                {child.label}: {String(child.before)} → {String(child.after)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pl-4 text-xs text-muted-foreground">
      {delta.label}: {String(delta.before)} → {String(delta.after)}
    </div>
  );
}

function BlockChangeRow({ change }: { change: BlockChange }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <KindBadge kind={change.kind} />
        <span className="font-medium">{change.label}</span>
        {change.partyLabel && (
          <span className="text-xs text-muted-foreground/70">({change.partyLabel})</span>
        )}
      </div>
      {change.fieldDeltas?.map((fd) => (
        <FieldDeltaRow key={fd.key} delta={fd} />
      ))}
    </div>
  );
}

function ListChangeRow({ change }: { change: ListChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <KindBadge kind={change.kind} />
      <span>{change.label}</span>
    </div>
  );
}

export function SaveConfirmDialog({ open, onOpenChange }: SaveConfirmDialogProps) {
  const { pendingDiff, documentFileReplaced, saveForm, markSaved, isSaving } =
    useFormEditorMetadata();
  const [confirming, setConfirming] = useState(false);

  const hasChanges = !pendingDiff.isEmpty || documentFileReplaced;

  async function handleConfirm() {
    setConfirming(true);
    try {
      await saveForm();
      markSaved();
      onOpenChange(false);
    } catch {
      // saveForm already shows an error toast; keep dialog open
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Save Form</DialogTitle>
          <DialogDescription>
            {hasChanges ? "Review your pending changes before saving." : "Nothing changed."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {documentFileReplaced && (
            <Section title="Base Document">
              <div>Base document replaced</div>
            </Section>
          )}

          {pendingDiff.metaDeltas.length > 0 && (
            <Section title="Form Details">
              {pendingDiff.metaDeltas.map((d) => (
                <div key={d.key}>
                  <span className="capitalize">{d.label}</span>: {String(d.before)} →{" "}
                  {String(d.after)}
                </div>
              ))}
            </Section>
          )}

          {pendingDiff.parties.length > 0 && (
            <Section title="Signing Parties">
              {pendingDiff.parties.map((p) => (
                <ListChangeRow key={p.id} change={p} />
              ))}
            </Section>
          )}

          {pendingDiff.subscribers.length > 0 && (
            <Section title="Subscribers">
              {pendingDiff.subscribers.map((s) => (
                <ListChangeRow key={s.id} change={s} />
              ))}
            </Section>
          )}

          {pendingDiff.blocks.length > 0 && (
            <Section title="Fields">
              {pendingDiff.blocks.map((b) => (
                <BlockChangeRow key={b.blockId} change={b} />
              ))}
            </Section>
          )}

          {pendingDiff.reordered && (
            <Section title="Order">
              <div>Fields reordered</div>
            </Section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!hasChanges || isSaving || confirming}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving || confirming ? "Saving…" : "Confirm Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
