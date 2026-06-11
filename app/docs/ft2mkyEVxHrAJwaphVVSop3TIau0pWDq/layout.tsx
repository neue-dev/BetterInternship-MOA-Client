/**
 * @ Author: BetterInternship
 * @ Description: Shared layout for the form-tooling routes (create-form, editor, etc).
 *   Mounts the FormDraftProvider so the create-form wizard's uploaded PDF and the
 *   "Creating form..." overlay survive the client-side nav between create-form and the
 *   editor.
 */

"use client";

import { FormDraftProvider } from "@/app/contexts/form-draft.context";
import { CreatingOverlay } from "@/components/docs/form-editor/CreatingOverlay";

export default function Ft2Layout({ children }: { children: React.ReactNode }) {
  return (
    <FormDraftProvider>
      {children}
      <CreatingOverlay />
    </FormDraftProvider>
  );
}
