"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BlockChange, ListChange } from "@/lib/form-editor-metadata/diff";

interface SaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Badge({ kind }: { kind: "added" | "removed" | "modified" }) {
  if (kind === "added")
    return <span className="mr-1.5 inline-block text-green-600">+</span>;
  if (kind === "removed")
    return <span className="mr-1.5 inline-block text-red-500">−</span>;
  return <span className="mr-1.5 inline-block text-blue-500">~</span>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>;
}

function ListRow({ change }: { change: ListChange }) {
  return (
    <Row>
      <Badge kind={change.kind} />
      {change.label}
    </Row>
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
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Save Form</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {!hasChanges && (
            <p className="text-sm text-muted-foreground">No changes to save.</p>
          )}

          {documentFileReplaced && (
            <div className="text-sm text-muted-foreground">
              <span className="mr-1.5 inline-block">📄</span>
              Base document replaced
            </div>
          )}

          {pendingDiff.metaDeltas.length > 0 && (
            <div className="space-y-1">
              {pendingDiff.metaDeltas.map((d) => (
                <div key={d.key} className="text-sm text-muted-foreground">
                  <span className="mr-1.5 inline-block">✏️</span>
                  {d.label} changed
                </div>
              ))}
            </div>
          )}

          {pendingDiff.parties.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Signing Parties
              </p>
              {pendingDiff.parties.map((p) => (
                <ListRow key={p.id} change={p} />
              ))}
            </div>
          )}

          {pendingDiff.subscribers.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Subscribers
              </p>
              {pendingDiff.subscribers.map((s) => (
                <ListRow key={s.id} change={s} />
              ))}
            </div>
          )}

          {pendingDiff.blocks.length > 0 && (() => {
            const groups = new Map<string, BlockChange[]>();
            for (const b of pendingDiff.blocks) {
              const key = b.partyLabel || "General";
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(b);
            }
            return Array.from(groups.entries()).map(([party, changes]) => (
              <div key={party} className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  {party}
                </p>
                {changes.map((b) => (
                  <Row key={b.blockId}>
                    <Badge kind={b.kind} />
                    {b.label}
                  </Row>
                ))}
              </div>
            ));
          })()}

          {pendingDiff.reordered && (
            <div className="text-sm text-muted-foreground">
              <span className="mr-1.5 inline-block">↕️</span>
              Fields reordered
            </div>
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
