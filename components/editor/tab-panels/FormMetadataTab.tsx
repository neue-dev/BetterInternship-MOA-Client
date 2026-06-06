"use client";

import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { Button } from "@/components/ui/button";
import { Copy, Download, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { IFormMetadata } from "@betterinternship/core/forms";
import { SCHEMA_VERSION } from "@betterinternship/core/forms";

const sanitizeMetadata = (metadata: IFormMetadata): IFormMetadata => ({
  name: metadata.name,
  label: metadata.label,
  schema_version: SCHEMA_VERSION,
  schema: {
    blocks: metadata.schema?.blocks || [],
  },
  signing_parties: metadata.signing_parties || [],
  subscribers: metadata.subscribers || [],
});

export function FormMetadataTab() {
  const { formMetadata, setFormMetadata } = useFormEditorMetadata();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<string>("");

  const metadataView = formMetadata ? sanitizeMetadata(formMetadata) : null;

  const handleCopyMetadata = () => {
    if (metadataView) {
      navigator.clipboard.writeText(JSON.stringify(metadataView, null, 2));
      toast.success("Metadata copied to clipboard!", toastPresets.success);
    }
  };

  const handleDownloadMetadata = () => {
    if (metadataView) {
      const element = document.createElement("a");
      const file = new Blob([JSON.stringify(metadataView, null, 2)], {
        type: "application/json",
      });
      element.href = URL.createObjectURL(file);
      element.download = `${metadataView.name}-metadata.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success("Metadata downloaded!", toastPresets.success);
    }
  };

  const handleStartEdit = () => {
    if (metadataView) {
      setEditedMetadata(JSON.stringify(metadataView, null, 2));
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editedMetadata) as IFormMetadata;
      setFormMetadata(sanitizeMetadata(parsed));
      setIsEditing(false);
      toast.success("Metadata updated!", toastPresets.success);
    } catch (error) {
      toast.error("Invalid JSON format", toastPresets.destructive);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedMetadata("");
  };

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Form Metadata</h2>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button onClick={handleCopyMetadata} variant="outline" size="sm" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  onClick={handleDownloadMetadata}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button onClick={handleStartEdit} variant="outline" size="sm" className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleSaveEdit} size="sm" className="gap-2">
                  <Check className="h-4 w-4" />
                  Save
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" size="sm" className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div className="bg-muted overflow-x-auto rounded-lg border p-4 font-mono text-xs">
            <pre>{JSON.stringify(metadataView, null, 2)}</pre>
          </div>
        ) : (
          <Textarea
            value={editedMetadata}
            onChange={(e) => setEditedMetadata(e.target.value)}
            className="h-[600px] font-mono text-xs"
          />
        )}
      </div>
    </div>
  );
}
