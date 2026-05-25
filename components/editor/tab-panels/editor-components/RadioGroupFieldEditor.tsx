"use client";

import { IFormBlock } from "@betterinternship/core/forms";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  currentBlockId: string;
  allBlocks: IFormBlock[];
  onUpdateOptionLabel: (blockId: string, label: string) => void;
};

export function RadioGroupFieldEditor({ currentBlockId, allBlocks, onUpdateOptionLabel }: Props) {
  const currentBlock = allBlocks.find((b) => b._id === currentBlockId);
  const groupId = (currentBlock?.field_schema as any)?.radio_group_id as string | undefined;

  if (!groupId) return null;

  const groupBlocks = allBlocks
    .filter(
      (b) =>
        b.block_type === "form_field" &&
        (b.field_schema as any)?.radio_group_id === groupId
    )
    .sort((a, b) => (a.field_schema?.x ?? 0) - (b.field_schema?.x ?? 0));

  return (
    <Card className="gap-2.5 p-2.5">
      <h4 className="text-muted-foreground text-xs font-semibold uppercase">Radio Group Options</h4>
      <p className="text-xs text-slate-500">
        Labels shown in the dropdown when filling this form.
      </p>
      <div className="space-y-1.5">
        {groupBlocks.map((block, idx) => {
          const schema = block.field_schema as any;
          const isCurrent = block._id === currentBlockId;
          return (
            <div
              key={block._id}
              className={cn(
                "flex items-center gap-2 rounded-[0.33em] border px-2 py-1",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-slate-200"
              )}
            >
              <span className="w-4 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
              <Input
                className="h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                value={schema?.radio_option_label ?? `Option ${idx + 1}`}
                onChange={(e) => onUpdateOptionLabel(block._id, e.target.value)}
                placeholder={`Option ${idx + 1}`}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
