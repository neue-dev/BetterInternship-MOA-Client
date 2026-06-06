# Create-Form Wizard + Editor Preload — Implementation Plan

Status: APPROVED, ready to implement. Written before a context compaction; contains
everything needed to implement without re-deriving.

## Goal (user's words, distilled)

1. If the **editor** route has no `form_name` URL param, redirect to `create-form`
   **before** the editor UI mounts (no flash of the editor).
2. Rework `create-form` into a small wizard:
   - **Step 1:** one Card containing (top → bottom) **Display Name** input, **Debug form**
     checkbox, then the **PDF upload** dropzone + inline preview. (Today these are in two
     separate Cards — merge into one.)
   - **Step 2:** a **modal** to specify signing parties — a **simple** enumerated list
     (NOT the rich PartiesPanel), default one entry (the initiator) labeled **"Student"**,
     with a full-width **"+"** add button **below** the list (as wide as the list).
   - Button is labeled **"Create"** (not "Next").
3. On **Create**: show a **semi-transparent full-screen loader** saying **"Creating form…"**,
   register the form, `router.push` to the editor, and once the editor has loaded behind it,
   **fade the overlay to 0 opacity** then unmount (editor revealed behind it).
4. The PDF uploaded in step 1 is **preloaded** into the editor: the same `File` object is
   reused so the editor does **not** re-download it from the network. (Editor still parses
   it once via its existing provider — that's acceptable.)

## Decisions locked (from Q&A)

- Form name + debug → on **step 1**, inside the **same card** as the PDF upload, **above** it.
- Parties UI → **simple enumerated list** (titles only); source/email/reorder stay deferred
  to the editor's existing Signing Parties UI.
- Preload depth → **reuse File, skip re-fetch** (editor's provider still parses once).
- Registration → **register, then navigate** (editor loads metadata by name as today).
- Transition → NOT seamless: a **"Creating form…" overlay** that fades out once the editor
  is loaded.
- Dead code (`activeTab === "parties"` branch) → leave alone for now.

## Current-state facts (verified)

- Routes are siblings under `MOA-Client/app/docs/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq/`:
  - `create-form/page.tsx`, `editor/page.tsx`. **No layout** exists at the `ft2…` level
    (nearest shared layout is `app/docs/layout.tsx`).
- `create-form/page.tsx` today: Display Name + Debug in one Card, PDF upload+preview in a
  second Card, `PartiesPanel` in a third Card, then a "Next" button that calls
  `formsControllerRegisterForm({ ...formMetadata, base_document: pdfFile })`, waits 1s, then
  `router.push(\`./editor?form_name=${encodeURIComponent(formName)}\`)`.
  - `formName` slug derived from `formLabel`: lowercase, non-alnum → `-`, trimmed; if
    `isDebugForm` and slug, prefixed `.debug-`.
  - Default `signingParties` = `[{ _id: "initiator", order: 1, signatory_title: "Student" }]`.
  - `IFormMetadata` shape used: `{ name, label, schema_version: SCHEMA_VERSION, schema: { blocks: [] }, signing_parties, subscribers: [] }`.
  - Imports: `IFormSigningParty, IFormMetadata, SCHEMA_VERSION` from `@betterinternship/core/forms`;
    `formsControllerRegisterForm` from `@/app/api`; `FormInput` from `@/components/docs/forms/EditForm`.
- `editor/page.tsx` today:
  - `FormEditorPage` = `<Suspense><FormEditorMetadataProvider><FormEditorContent/></...>`.
  - `FormEditorContent` reads `form_name` via `useSearchParams()`.
  - Uses `useFormsControllerGetLatestFormDocumentAndMetadata({ name: formName || "" })`.
  - Bootstrap effect (deps `[formName, fetchedData]`): if `formName` + `fetchedData.formMetadata`,
    seeds `loadFormMetadata/setFormDocument/setFormVersion/setDocumentUrl`, and on **initial
    bootstrap** does `fetch(fetchedData.documentUrl) → blob → new File([blob], \`${formName}.pdf\`,
    {type:"application/pdf"}) → setDocumentFile(file)`. Has a `hasBootstrappedRef` and
    `activeFormNameRef`.
  - **No-`formName` branch** currently seeds `BLANK_FORM_METADATA` (create-new path) — THIS IS
    WHAT WE REPLACE with a redirect to `create-form`.
  - On `isLoading` it returns `<FormEditorLoadingFallback label="Loading form..." />`.
  - When loaded, renders `<EditorSelectionProvider><FormEditorPdfViewerProvider>…<EditorToolbar/>…<EditorContent/>`.
- `form-editor-metadata.context.tsx` exposes `documentFile, setDocumentFile, documentFileReplaced,
  setDocumentUrl`, etc. (see `useFormEditorMetadata`).
- `pdf-viewer.context.tsx` (`FormEditorPdfViewerProvider`): parses `documentFile` once,
  identity-keyed via `loadedFileRef` (same `File` ⇒ no re-parse). Page-scoped (remounts per
  editor mount).
- `PartiesPanel` (`components/docs/form-editor/form-layout/PartiesPanel.tsx`): rich editor
  (drag reorder, source/email dropdowns, validation). **Still used** by the editor via
  `SigningPartiesTab` → reached through **Settings → Recipients** (`FormSettingsTab.tsx:105`,
  `section === "recipients"`). The `EditorContent.tsx:52` `activeTab === "parties"` branch is
  DEAD (toolbar only sets `editor`/`settings`). ⇒ Do **not** delete `PartiesPanel`; just stop
  importing it in create-form.
- `app/docs/layout.tsx` already hides the header on the editor route
  (`pathname.includes("/editor")`). It wraps everything in `<Providers>` and an auth gate.

## Files to create / change

### A. NEW — `app/contexts/form-draft.context.tsx`
Client context. In-memory only (no persistence) — the whole point is to preserve the `File`
object identity across the route nav while the shared `ft2…` layout stays mounted.

State + API:
```ts
interface FormDraftContextType {
  // wizard data
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  signingParties: IFormSigningParty[];
  setSigningParties: (p: IFormSigningParty[]) => void;
  formLabel: string;
  setFormLabel: (s: string) => void;
  isDebugForm: boolean;
  setIsDebugForm: (b: boolean) => void;
  formName: string | null;        // slug, set on Create (the form we just registered)
  setFormName: (s: string | null) => void;

  // transition / overlay
  isCreating: boolean;            // overlay visible (covering)
  setIsCreating: (b: boolean) => void;
  markEditorReady: () => void;    // editor signals load done → overlay fades out

  clearDraft: () => void;         // reset everything incl. transition flags
}
```
- Default `signingParties`: `[{ _id: "initiator", order: 1, signatory_title: "Student" }]`.
- `markEditorReady()` should drive the overlay's fade-out. Simplest implementation: keep a
  separate `overlayState: "hidden" | "visible" | "fading"` derived internally, OR expose a
  boolean `editorReady` that the overlay component watches to start its CSS opacity transition,
  unmounting on `transitionend`. Keep the fade logic in the overlay component (D), context just
  exposes the signal.
- `clearDraft()` resets pdfFile/parties/label/debug/formName and transition flags.
- `useFormDraft()` hook throws if used outside provider.

### B. NEW — `app/docs/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq/layout.tsx`
`"use client"`. Wraps children in `<FormDraftProvider>` and renders the overlay above children:
```tsx
export default function Ft2Layout({ children }) {
  return (
    <FormDraftProvider>
      {children}
      <CreatingOverlay />   {/* reads useFormDraft(); fixed, full-screen */}
    </FormDraftProvider>
  );
}
```
This is the nearest common ancestor of create-form + editor, so it stays mounted across the
nav — the `File` survives and the overlay persists through the transition, fading out over the
already-mounted editor. (It also wraps the other `ft2…` sibling pages: fields/registry/sync/
form-groups — harmless; context just unused there, overlay hidden by default.)

### C. REWRITE — `app/docs/ft2…/create-form/page.tsx`
Becomes a 2-step wizard. Reads/writes the draft store (so values survive the nav). Local
`step` state (`1 | 2`) or a boolean `partiesModalOpen`.

- **Step 1 — single Card**, in order:
  1. Display Name (`FormInput`, value=`formLabel` from draft, `setter=setFormLabel`).
  2. Debug form checkbox (`Checkbox` + `Label`, bound to `isDebugForm`).
  3. derived `formName` hint line (keep existing "Form name: <slug>" display).
  4. PDF dropzone (existing `<label>` + hidden `<input type=file accept=.pdf>`,
     `handlePdfUpload` validates `application/pdf`, sets `pdfFile`).
  5. PDF inline preview (`<object data={previewUrl} ...>` with iframe fallback). Build the
     object URL from `pdfFile` with `URL.createObjectURL` in an effect, revoke on cleanup
     (same as today).
  - Footer button (e.g. "Continue" / "Next →") advances to step 2; disabled unless a PDF is
    present and `formLabel` is non-empty. (Keep the `formName`/debug derivation logic from
    today.)
- **Step 2 — modal** (`@/components/ui/dialog` — VERIFY it exists; fallback: existing modal
  primitive used elsewhere). Contents:
  - Title e.g. "Who needs to sign?"
  - `<SimplePartiesList parties={signingParties} onChange={setSigningParties} />` (component D-bis).
  - Footer: **Back** (→ step 1, keep modal data) and **Create** (primary).
- **Create handler** (`handleCreate`):
  1. validate: pdf present, label present, all party titles non-empty.
  2. `setIsCreating(true)` (overlay appears, "Creating form…").
  3. build `formMetadata` exactly as today (`name: formName, label: formLabel, schema_version:
     SCHEMA_VERSION, schema: { blocks: [] }, signing_parties: signingParties, subscribers: []`).
  4. `await formsControllerRegisterForm({ ...formMetadata, base_document: pdfFile })`.
  5. write draft: `setFormName(formName)` (pdfFile + parties already in draft).
  6. `router.push(\`./editor?form_name=${encodeURIComponent(formName)}\`)`.
  - On error: `setIsCreating(false)`, keep modal open on step 2, `toast.error(...)`. No nav.
  - Keep the existing brief `await new Promise(r => setTimeout(r, 1000))` BEFORE the push if the
    backend needs a beat to make the metadata fetchable — but since the overlay now covers the
    load, this is less critical. Prefer: push immediately; the editor's react-query fetch +
    overlay cover the gap. (If metadata 404s right after register, reinstate the small wait.)
- Stop importing `PartiesPanel`. Keep using `IFormSigningParty/IFormMetadata/SCHEMA_VERSION`,
  `formsControllerRegisterForm`, `FormInput`, `Checkbox`, `Label`, `Card`, `Button`, toasts.

### D. NEW — `CreatingOverlay` component
Location: co-locate in `form-draft.context.tsx` or a small file
`components/docs/form-editor/CreatingOverlay.tsx`. Reads `useFormDraft()`.
- Renders only when `isCreating` (or while fading).
- Fixed, inset-0, `z-[100]`, semi-transparent backdrop (e.g. `bg-white/70 backdrop-blur-sm`),
  centered `<Loader/>` (`@/components/ui/loader`) + text "Creating form…".
- CSS opacity transition. Visible at opacity-100 while loading; when `editorReady` signal fires
  (via `markEditorReady`), transition opacity → 0 (e.g. `duration-500`), then unmount on
  `transitionend` (or a timeout fallback). After unmount, the context can `clearDraft()` —
  OR the editor clears the draft after it seeds (see E). Pick one owner for clear; recommend
  the editor clears draft data after seeding, and the overlay clears only its own transition
  flags. Keep `pdfFile` alive until the editor has seeded it.

### D-bis. NEW — `SimplePartiesList` component
Location: `components/docs/form-editor/form-layout/SimplePartiesList.tsx`.
Props: `{ parties: IFormSigningParty[]; onChange: (p: IFormSigningParty[]) => void }`.
- Renders `parties` sorted by `order`, enumerated (#1, #2, …).
- Row #1 (initiator, `order === 1`): fixed label "Student" (read-only, no delete, no source).
- Rows #2+: a text input for `signatory_title` + a delete (trash) button.
- **Full-width "+ Add recipient"** button below the list (width = list width).
- Add: new party `{ _id: \`party-${n}\`, order: max(order)+1, signatory_title: "Party" }`
  (titles only — NO signatory_source/account here; deferred to editor). Use an incrementing
  counter for unique ids.
- Delete: remove by `_id`, never the `order === 1` initiator; re-derive `order` if desired.
- No drag/reorder, no source/email, no validation beyond non-empty title (the page checks
  titles before enabling Create).
- Keep it dependency-light (Button, lucide `Plus`/`Trash2`, Card optional).

### E. EDIT — `app/docs/ft2…/editor/page.tsx`
In `FormEditorContent`:
1. **Guard:** add `const router = useRouter()` and read draft via `useFormDraft()`. If
   `!formName`: `useEffect(() => { router.replace("./create-form"); }, [])` and render only the
   loading fallback (return early). REMOVE the `else if (isInitialBootstrap)` BLANK_FORM_METADATA
   branch in the bootstrap effect (now unreachable). Keep `BLANK_FORM_METADATA` import only if
   still used elsewhere (it isn't after removal → drop the import).
2. **Seed from draft (skip re-fetch):** in the bootstrap effect, on initial bootstrap, BEFORE
   the `fetch(documentUrl)` path: if `draft.formName === formName && draft.pdfFile`, call
   `setDocumentFile(draft.pdfFile)` and SKIP the network `fetch(...)`. Then proceed to set
   `isLoading=false`, `hasBootstrappedRef=true` as in the metadata-only branch. Still call
   `loadFormMetadata/setFormDocument/setFormVersion/setDocumentUrl` from `fetchedData` so blocks/
   titles are correct. (i.e. metadata from API, PDF bytes from memory.)
   - If no matching draft pdf → keep existing `fetch(documentUrl)` behavior unchanged.
3. **Signal ready + clear:** once the editor has finished its initial bootstrap and the PDF is
   ready (isLoading flipped false), call `draft.markEditorReady()` so the overlay fades out.
   Recommended: a `useEffect` that runs when `!isLoading && hasBootstrappedRef.current` (guard so
   it fires once) → `draft.markEditorReady()`. After the overlay has faded, clear the consumed
   draft pdf/formName so a stale File can't leak into a later load. Implement clear by reading
   `draft.pdfFile` into a local before seeding, OR call `draft.clearDraft()` after
   `markEditorReady` once it's safe (the provider already handed the File to the metadata
   context, which holds its own reference). Order matters: seed `documentFile` FIRST, then clear.
   - Note: `markEditorReady` must only fire for the freshly-created form (when we actually
     seeded from draft). For normal loads of existing forms (no draft) it's fine to also signal
     ready (overlay isn't visible then, so it's a no-op). Simplest: always call when bootstrap
     completes.

## Verification step BEFORE coding the parties modal

Confirm the register endpoint accepts a non-initiator signing party with **only a title** (no
`signatory_source` / `signatory_account`). Check the API/controller types behind
`formsControllerRegisterForm` and the `IFormSigningParty` schema in `@betterinternship/core/forms`.
- If allowed → proceed with titles-only `SimplePartiesList`.
- If rejected → fall back to also collecting an email per non-initiator row in the modal
  (minimal: one email input per row, set `signatory_account = { name: email.split("@")[0], email }`).

## Component / import reference (so we don't re-grep)

- Dialog: `@/components/ui/dialog` (VERIFY export names: Dialog/DialogContent/DialogHeader/
  DialogTitle/DialogFooter). If absent, search `components/ui` for the modal primitive in use.
- Loader: `@/components/ui/loader` → `<Loader />` (and `<Loader>text</Loader>` supported, see
  docs/layout.tsx usage).
- Button: `@/components/ui/button`; Card: `@/components/ui/card`; Checkbox:
  `@/components/ui/checkbox`; Label: `@/components/ui/label`; FormInput:
  `@/components/docs/forms/EditForm`.
- Toasts: `import { toast } from "sonner"`; presets `@/components/sonner-toaster`
  (`toastPresets.destructive`).
- Types/API: `IFormSigningParty, IFormMetadata, SCHEMA_VERSION` from `@betterinternship/core/forms`;
  `formsControllerRegisterForm`, `useFormsControllerGetLatestFormDocumentAndMetadata` from `@/app/api`.
- Party colors helper (if needed for the Student chip): `@/lib/party-colors`
  (`getPartyColorByOrder`, `getPartyDisplayTitle`).

## Out of scope (do not touch)

- The dead `activeTab === "parties"` branch and the broader editor nav unification (deferred
  item E from the prior refactor).
- Replacing `PartiesPanel` in the editor's Settings → Recipients. (Separate opt-in.)
- Hoisting PDF parsing to the layout (we chose "reuse File, skip re-fetch", not "reuse parsed
  doc").

## Suggested implementation order

1. Verify register endpoint accepts titles-only parties (+ Dialog export names).
2. `form-draft.context.tsx` (context + provider + hook) and `CreatingOverlay`.
3. `ft2…/layout.tsx`.
4. `SimplePartiesList`.
5. Rewrite `create-form/page.tsx` (step 1 single card + step 2 modal + Create handler).
6. Edit `editor/page.tsx` (guard + seed-from-draft + markEditorReady).
7. Manual run-through: no-param editor → redirect; upload+name → modal → Create → overlay →
   editor with PDF already shown → overlay fades. Error path keeps modal open.
