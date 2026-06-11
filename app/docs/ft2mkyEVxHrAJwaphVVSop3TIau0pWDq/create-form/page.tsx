"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, ArrowRight, ArrowLeft, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "@/components/docs/forms/EditForm";
import { SimplePartiesList } from "@/components/docs/form-editor/form-layout/SimplePartiesList";
import { PdfFilePreview } from "@/components/docs/form-editor/form-layout/PdfFilePreview";
import { IFormMetadata, SCHEMA_VERSION } from "@betterinternship/core/forms";
import { formsControllerRegisterForm } from "@/app/api";
import { Card } from "@/components/ui/card";
import { HeaderIcon, HeaderText } from "@/components/ui/text";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useFormDraft } from "@/app/contexts/form-draft.context";

const TOTAL_STEPS = 2;

const CreateFormPage = () => {
  const router = useRouter();
  const {
    pdfFile,
    setPdfFile,
    signingParties,
    setSigningParties,
    formLabel,
    setFormLabel,
    isDebugForm,
    setIsDebugForm,
    setFormName,
    setIsCreating,
  } = useFormDraft();

  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive form name from label (hyphen-separated, lowercase).
  const formName = useMemo(() => {
    const slug = formLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return isDebugForm && slug ? `.debug-${slug}` : slug;
  }, [formLabel, isDebugForm]);

  const hasMissingPartyTitle = useMemo(
    () => signingParties.some((party) => !party.signatory_title?.trim()),
    [signingParties]
  );

  const canContinue = !!pdfFile && !!formLabel.trim();

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setPdfFile(file);
    toast.success("PDF uploaded successfully");
  };

  const handleContinue = () => {
    if (!canContinue) {
      toast.error("Please upload a PDF and enter a display name");
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (!pdfFile) {
      toast.error("Please upload a PDF file");
      return;
    }
    if (!formLabel.trim()) {
      toast.error("Please enter a form label");
      return;
    }
    if (signingParties.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }
    if (hasMissingPartyTitle) {
      toast.error("Please complete all recipient titles");
      return;
    }

    // Show the full-screen "Creating form..." overlay (lives in the ft2 layout, so it
    // persists across the nav to the editor and fades out once the editor has loaded).
    setIsCreating(true);

    try {
      const formMetadata: IFormMetadata = {
        name: formName,
        label: formLabel,
        schema_version: SCHEMA_VERSION,
        schema: { blocks: [] },
        signing_parties: signingParties,
        subscribers: [],
      };

      await formsControllerRegisterForm({
        ...formMetadata,
        base_document: pdfFile,
      });

      // Record the registered form name so the editor can match the draft and reuse the
      // already-uploaded PDF instead of re-downloading it.
      setFormName(formName);

      // Brief beat so the backend can make the freshly-registered metadata fetchable.
      // The overlay covers this gap.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      router.push(`./editor?form_name=${encodeURIComponent(formName)}`);
    } catch (error) {
      console.error("Error creating form:", error);
      toast.error(
        `Failed to create form: ${error instanceof Error ? error.message : String(error)}`
      );
      // Hide the overlay and stay on step 2 so the user can retry.
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/40 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <HeaderIcon icon={Upload} />
          <HeaderText> Create new form</HeaderText>
          <span className="ml-auto text-xs font-medium text-slate-400/80">
            Step {step}/{TOTAL_STEPS}
          </span>
        </div>

        {/* Step 1: name + debug + PDF upload, all in one card. */}
        {step === 1 && (
          <Card className="gap-3 border-slate-200 px-5 py-3.5">
            <p className="text-sm font-semibold">Display Name</p>
            <FormInput
              placeholder="Student MOA"
              value={formLabel}
              setter={setFormLabel}
              required={true}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="debug-form"
                checked={isDebugForm}
                onCheckedChange={(checked) => setIsDebugForm(checked === true)}
              />
              <Label htmlFor="debug-form" className="text-sm font-normal text-slate-700">
                Debug form
              </Label>
            </div>
            {formLabel && (
              <p className="text-xs text-slate-500">
                Form name:{" "}
                <span className="font-mono font-semibold text-slate-700">{formName}</span>
              </p>
            )}

            {/* Single hidden input, reused by both the dropzone and "choose another". */}
            <input
              ref={fileInputRef}
              id="pdf-input"
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />

            {!pdfFile ? (
              <label
                htmlFor="pdf-input"
                className="mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-[0.33em] border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-colors hover:border-slate-400 hover:bg-slate-100"
              >
                <Upload className="h-8 w-8 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Click to upload PDF</p>
                  <p className="mt-1 text-xs text-slate-600">Drag and drop or click to select</p>
                </div>
              </label>
            ) : (
              <div className="mt-1">
                {/* Preview card: rounded on top only. */}
                <div className="overflow-hidden rounded-t-[0.33em] border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                    <p className="truncate text-xs font-medium text-slate-600">{pdfFile.name}</p>
                  </div>
                  <PdfFilePreview file={pdfFile} />
                </div>
                {/* Connected below the preview: shares the card's bottom border, rounded bottom only. */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-b-[0.33em] border border-t-0 border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Choose another PDF
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Step 2: signing parties. */}
        {step === 2 && (
          <Card className="gap-3 border-slate-200 px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Who needs to sign?</p>
              <p className="mt-0.5 text-xs text-slate-500">
                The student initiates this form. Add anyone else who must sign it.
              </p>
            </div>
            <SimplePartiesList parties={signingParties} onChange={setSigningParties} />
          </Card>
        )}

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          {step === 2 ? (
            <Button
              variant="outline"
              size="md"
              onClick={() => setStep(1)}
              className="items-center gap-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Button>
          ) : (
            <span />
          )}

          {step === 1 ? (
            <Button
              onClick={handleContinue}
              disabled={!canContinue}
              size="md"
              className="items-center gap-2"
            >
              Continue
              <ArrowRight className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={hasMissingPartyTitle}
              size="md"
              className="items-center gap-2"
            >
              <Check className="h-3 w-3" />
              Create
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateFormPage;
