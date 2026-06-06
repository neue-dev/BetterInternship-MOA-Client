/**
 * @ Author: BetterInternship
 * @ Description: Full-screen "Creating form..." overlay shown after pressing Create
 *   on the wizard. Lives in the shared ft2 layout so it persists across the nav from
 *   create-form to the editor, then fades out once the editor signals it has loaded.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui/loader";
import { useFormDraft } from "@/app/contexts/form-draft.context";
import { cn } from "@/lib/utils";

// Matches the fade duration below; the fallback waits a touch longer.
const FADE_MS = 500;

export function CreatingOverlay() {
  const { isCreating, editorReady, clearDraft } = useFormDraft();
  const [mounted, setMounted] = useState(false);

  const teardown = () => {
    // The editor has already copied the File into its own metadata context, so
    // clearing the draft here is safe.
    setMounted(false);
    clearDraft();
  };

  // Mount the overlay (at full opacity) as soon as creation starts. If creation is
  // aborted before the editor is ready (e.g. registration failed), tear it down
  // immediately so it doesn't strand the user behind a covering layer.
  useEffect(() => {
    if (isCreating) setMounted(true);
    else if (!editorReady) setMounted(false);
  }, [isCreating, editorReady]);

  // Fallback teardown in case `transitionend` never fires (e.g. reduced-motion, or
  // the element never actually animates) — otherwise the invisible overlay would keep
  // blocking clicks.
  useEffect(() => {
    if (!mounted || !editorReady) return;
    const t = setTimeout(teardown, FADE_MS + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, editorReady]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center",
        "bg-white/70 backdrop-blur-sm transition-opacity duration-500",
        editorReady ? "opacity-0" : "opacity-100"
      )}
      onTransitionEnd={() => {
        // Once the fade-out completes, tear down the overlay and reset the draft.
        if (editorReady) teardown();
      }}
    >
      <Loader>
        <p className="text-muted-foreground text-sm">Creating form...</p>
      </Loader>
    </div>
  );
}
