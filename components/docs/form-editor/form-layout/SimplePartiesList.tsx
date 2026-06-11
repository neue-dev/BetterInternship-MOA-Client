/**
 * @ Author: BetterInternship
 * @ Description: Minimal signing-parties editor used by the create-form wizard. Shows
 *   an enumerated list of recipients (the initiator is a fixed "Student" row), each with
 *   an editable title, plus a full-width "add recipient" button. Source/email/reorder are
 *   intentionally deferred to the editor's richer Signing Parties UI.
 */

"use client";

import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IFormSigningParty } from "@betterinternship/core/forms";

interface SimplePartiesListProps {
  parties: IFormSigningParty[];
  onChange: (parties: IFormSigningParty[]) => void;
}

export function SimplePartiesList({ parties, onChange }: SimplePartiesListProps) {
  // Monotonic counter so added rows always get a unique _id, even after deletes.
  const nextIdRef = useRef(1);

  const sorted = [...parties].sort((a, b) => a.order - b.order);

  const handleTitleChange = (id: string, title: string) => {
    onChange(parties.map((p) => (p._id === id ? { ...p, signatory_title: title } : p)));
  };

  const handleAdd = () => {
    const maxOrder = parties.reduce((max, p) => Math.max(max, p.order), 0);
    const newParty: IFormSigningParty = {
      _id: `party-${nextIdRef.current++}`,
      order: maxOrder + 1,
      signatory_title: "",
    };
    onChange([...parties, newParty]);
  };

  const handleDelete = (id: string) => {
    // Never remove the initiator (order === 1).
    const remaining = parties.filter((p) => p._id !== id && p.order !== 1);
    const initiator = parties.find((p) => p.order === 1);
    const next = initiator ? [initiator, ...remaining] : remaining;
    // Re-derive contiguous order values.
    const reordered = [...next]
      .sort((a, b) => a.order - b.order)
      .map((p, i) => ({ ...p, order: i + 1 }));
    onChange(reordered);
  };

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {sorted.map((party, index) => {
          const isInitiator = party.order === 1;
          return (
            <li key={party._id} className="flex items-center gap-2">
              <span className="text-muted-foreground w-5 shrink-0 text-right text-sm tabular-nums">
                {index + 1}.
              </span>
              {isInitiator ? (
                <div className="flex h-10 flex-1 items-center rounded-[0.33em] border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                  Student
                </div>
              ) : (
                <input
                  type="text"
                  value={party.signatory_title ?? ""}
                  onChange={(e) => handleTitleChange(party._id, e.target.value)}
                  placeholder="Recipient title (e.g. Supervisor)"
                  className="h-10 flex-1 rounded-[0.33em] border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                />
              )}
              {isInitiator ? (
                <div className="w-10 shrink-0" aria-hidden />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(party._id)}
                  aria-label="Remove recipient"
                  className="shrink-0 text-slate-400 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add recipient
      </Button>
    </div>
  );
}
