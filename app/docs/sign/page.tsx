"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FormFillerRenderer } from "@/components/docs/forms/FormFillerRenderer";
import { RejectFormButton, SubmitFormButton } from "@/components/docs/forms/FormActionButtons";
import { useFormRendererContext } from "@/components/docs/forms/form-renderer.ctx";
import { useFormProcess } from "@/components/docs/forms/form-process.ctx";
import { useFormFiller } from "@/components/docs/forms/form-filler.ctx";
import { FormPreviewPdfDisplay } from "@/components/docs/forms/previewer";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { useMyAutofill } from "@/hooks/use-my-autofill";
import { useSignContext } from "../auth/provider/sign.ctx";
import { useSignatoryProfile } from "../auth/provider/signatory.ctx";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, LucideClipboardCheck } from "lucide-react";
import { formsControllerMarkFormAsFirstViewed } from "@/app/api";
import { withDerivedFormValues } from "@/lib/derived-form-values";
import { withSavedSignatureImagesForFields } from "@/lib/saved-signature-image";
import { cn } from "@/lib/utils";
import { DelegateEmailScreen } from "./components/DelegateEmailScreen";
import { MobileStepTabs } from "./components/MobileStepTabs";
import { SignIntentGate } from "./components/SignIntentGate";
import { useIsMobile } from "@/hooks/use-mobile";

type MobileSigningStep = "fields" | "preview-review" | "confirm";
const COMPACT_SIGNING_LAYOUT_BREAKPOINT_PX = 1150;

const areFormValuesEqual = (left: Record<string, string>, right: Record<string, string>) => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([key, value]) => right[key] === value);
};

const Page = () => {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
};

function PageContent() {
  const [view, setView] = useState<"choice" | "form" | "delegate">("choice");
  const [mobileStep, setMobileStep] = useState<MobileSigningStep>("fields");
  const [desktopStep, setDesktopStep] = useState<MobileSigningStep>("fields");
  const [mobileFieldsTab, setMobileFieldsTab] = useState<"form" | "preview">("form");
  const [mobilePreviewNeedsAttention, setMobilePreviewNeedsAttention] = useState(false);
  const [selectedFieldSource, setSelectedFieldSource] = useState<"form" | "pdf">("form");
  const [selectionTick, setSelectionTick] = useState(0);
  const [hasConfirmedDetails, setHasConfirmedDetails] = useState(false);
  const [delegateEmail, setDelegateEmail] = useState("");
  const params = useSearchParams();
  const isMobile = useIsMobile();
  const [isCompactSigningLayout, setIsCompactSigningLayout] = useState(false);
  const isMobileLayout = isMobile || isCompactSigningLayout;
  const profile = useSignatoryProfile();
  const form = useFormRendererContext();
  const formProcess = useFormProcess();
  const formFiller = useFormFiller();
  const autofillValues = useMyAutofill();
  const signContext = useSignContext();
  const finalValues = useMemo(
    () => formFiller.getFinalValues(autofillValues),
    [formFiller, form, autofillValues]
  );
  const previewValues = useMemo(
    () =>
      withDerivedFormValues(
        form.formMetadata as Parameters<typeof withDerivedFormValues>[0],
        finalValues
      ),
    [form.formMetadata, finalValues]
  );
  const previewPrefillUser = useMemo(
    () => ({
      ...(profile as unknown as Record<string, unknown>),
      ...(autofillValues as unknown as Record<string, unknown>),
    }),
    [profile, autofillValues]
  );
  const hasInitializedPreviewValuesRef = useRef(false);
  const latestPreviewValuesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateCompactSigningLayout = () => {
      setIsCompactSigningLayout(window.innerWidth < COMPACT_SIGNING_LAYOUT_BREAKPOINT_PX);
    };

    updateCompactSigningLayout();
    window.addEventListener("resize", updateCompactSigningLayout);
    return () => {
      window.removeEventListener("resize", updateCompactSigningLayout);
    };
  }, []);

  useEffect(() => {
    const formProcessId = (params.get("form-process-id") || "").trim();
    const supposedSigningPartyId = (params.get("signing-party-id") || "").trim();
    formProcess.setFormProcessId(formProcessId);
    formProcess.setSupposedSigningPartyId(supposedSigningPartyId);
  }, [params]);

  useEffect(() => {
    const formName = formProcess.form_name;
    const signingPartyId = formProcess.my_signing_party_id;

    if (formName && signingPartyId) {
      form.updateFormName(formName);
      form.updateSigningPartyId(signingPartyId);
    }
  }, [formProcess]);

  const markAsViewed = async (formProcessId: string) => {
    try {
      await formsControllerMarkFormAsFirstViewed({ formProcessId });
    } catch (error) {
      console.warn("Failed to mark form as first viewed:", error);
    }
  };

  useEffect(() => {
    if (formProcess.id && profile.id) void markAsViewed(formProcess.id);
  }, [formProcess.id, profile.id]);

  useEffect(() => {
    if (!formProcess.my_signing_party_id || !form.formName) return;

    const signatureFields = form.formMetadata.getSignatureFieldsForClientService(
      formProcess.my_signing_party_id
    );
    const valuesWithPrefilledSignatures = form.formMetadata.setSignatureValueForSigningParty(
      formFiller.getFinalValues(autofillValues),
      profile.name,
      formProcess.my_signing_party_id
    );
    const valuesWithSavedSignatureImages = withSavedSignatureImagesForFields({
      values: valuesWithPrefilledSignatures,
      signatureFields,
      signatureImage: profile.signatureImage,
    });

    formFiller.initializeValues(valuesWithSavedSignatureImages);
    signContext.setRequiredSignatures(
      signatureFields.map((signatureField) => signatureField.field)
    );

    for (const signatureField of signatureFields) {
      const signatureValue = valuesWithSavedSignatureImages[signatureField.field];
      if (signatureValue?.trim()) {
        signContext.setHasAgreedForSignature(signatureField.field, signatureValue, true);
      }
    }
  }, [formProcess, form, profile.signatureImage]);

  useEffect(() => {
    if (view !== "form") {
      setDesktopStep("fields");
      setMobileStep("fields");
      setMobileFieldsTab("form");
      setMobilePreviewNeedsAttention(false);
      setHasConfirmedDetails(false);
      hasInitializedPreviewValuesRef.current = false;
      latestPreviewValuesRef.current = {};
    }
  }, [view]);

  useEffect(() => {
    setDesktopStep("fields");

    if (!isMobileLayout) {
      setMobileStep("fields");
      setMobileFieldsTab("form");
      setMobilePreviewNeedsAttention(false);
      setHasConfirmedDetails(false);
      hasInitializedPreviewValuesRef.current = false;
      latestPreviewValuesRef.current = {};
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (mobileStep === "confirm") {
      setHasConfirmedDetails(false);
    }
  }, [mobileStep]);

  useEffect(() => {
    if (desktopStep === "confirm") {
      setHasConfirmedDetails(false);
    }
  }, [desktopStep]);

  const previewBlocks = useMemo(() => {
    if (!form.formMetadata) return [];
    return form.formMetadata
      .getBlocksForEditorService()
      .filter((block) => block.field_schema || block.phantom_field_schema);
  }, [form.formMetadata]);

  const signingParties = useMemo(
    () => (form.formMetadata ? form.formMetadata.getSigningParties() : []),
    [form.formMetadata]
  );
  const mySigningParty = signingParties.find(
    (signingParty) => signingParty._id === formProcess.my_signing_party_id
  );
  const shouldShowSignIntentGate =
    typeof mySigningParty?.signatory_source?._id === "string" &&
    mySigningParty.signatory_source._id.trim().length > 0;
  const currentView = shouldShowSignIntentGate ? view : "form";
  const hideHeaderForIntentGate = shouldShowSignIntentGate && currentView === "choice";
  const showOuterHeader = !hideHeaderForIntentGate && (isMobileLayout || currentView !== "form");
  const desktopHeaderTaskTitle =
    currentView === "delegate"
      ? "Forward this form to the actual signer"
      : desktopStep === "confirm"
        ? "Confirm before submitting"
        : "Fill required fields or reject this form";
  const desktopHeaderStepNumber =
    currentView === "delegate" ? 1 : desktopStep === "confirm" ? 2 : 1;
  const desktopHeaderTotalSteps = currentView === "delegate" ? 1 : 2;
  const desktopHeaderProgressPercent =
    desktopHeaderTotalSteps <= 1 ? 100 : (desktopHeaderStepNumber / desktopHeaderTotalSteps) * 100;

  useEffect(() => {
    const didValuesChange = !areFormValuesEqual(latestPreviewValuesRef.current, previewValues);
    latestPreviewValuesRef.current = previewValues;

    if (!hasInitializedPreviewValuesRef.current) {
      hasInitializedPreviewValuesRef.current = true;
      return;
    }

    if (
      didValuesChange &&
      isMobileLayout &&
      currentView === "form" &&
      mobileStep === "fields" &&
      mobileFieldsTab !== "preview"
    ) {
      setMobilePreviewNeedsAttention(true);
    }
  }, [currentView, isMobileLayout, mobileFieldsTab, mobileStep, previewValues]);

  const mobileSteps: MobileSigningStep[] = ["fields", "preview-review", "confirm"];
  const mobileStepNumber = mobileSteps.indexOf(mobileStep) + 1;
  const mobileStepIndexByStep = useMemo(
    () => new Map(mobileSteps.map((step, index) => [step, index])),
    [mobileSteps]
  );
  const mobileStepTitles: Record<MobileSigningStep, string> = {
    fields: "Fill required fields or reject this form",
    "preview-review": "Review your inputs",
    confirm: "Confirm before submitting",
  };
  const mobileFieldsTabs = [
    { id: "form", label: "Fill Details" },
    { id: "preview", label: "PDF Preview", attentionState: mobilePreviewNeedsAttention },
  ];
  const canAdvanceFromFields = !!signContext.hasAgreed;
  const isMobilePreviewTabActive =
    isMobileLayout &&
    currentView === "form" &&
    mobileStep === "fields" &&
    mobileFieldsTab === "preview";
  const mobileStepPaneHiddenClass = "opacity-0 pointer-events-none";
  const getMobileStepHiddenClass = (step: MobileSigningStep) => {
    const currentIndex = mobileStepIndexByStep.get(mobileStep) ?? 0;
    const stepIndex = mobileStepIndexByStep.get(step) ?? 0;

    return stepIndex < currentIndex
      ? "-translate-x-6 opacity-0 pointer-events-none"
      : "translate-x-6 opacity-0 pointer-events-none";
  };

  const goToMobileStep = (nextStep: MobileSigningStep) => {
    setMobileStep(nextStep);
  };

  const handleMobileFieldsTabChange = useCallback((nextTab: "form" | "preview") => {
    setMobileFieldsTab(nextTab);

    if (nextTab === "preview") {
      setMobilePreviewNeedsAttention(false);
    }
  }, []);

  const handlePdfFieldSelect = (fieldName: string) => {
    setSelectedFieldSource("pdf");
    setSelectionTick((prev) => prev + 1);
    form.setSelectedPreviewId(fieldName);
    handleMobileFieldsTabChange("form");
  };

  const handleFormFieldSelect = (fieldName: string) => {
    setSelectedFieldSource("form");
    setSelectionTick((prev) => prev + 1);
    form.setSelectedPreviewId(fieldName);
  };

  const validateFields = () => {
    const errors = formFiller.validate(form.fields, autofillValues);
    if (Object.keys(errors).length) {
      toast.error("Some information is missing or incorrect");
      return false;
    }

    return true;
  };

  const handleMobileFieldsNext = () => {
    if (!validateFields()) return;

    goToMobileStep("preview-review");
  };

  const renderMobileFieldsTabs = () =>
    isMobileLayout && mobileStep === "fields" ? (
      <MobileStepTabs
        tabs={mobileFieldsTabs}
        activeTab={mobileFieldsTab}
        onTabChange={(tabId) => handleMobileFieldsTabChange(tabId as "form" | "preview")}
      />
    ) : null;

  if (formProcess.error) {
    return (
      <div className="bg-opacity-25 relative mx-auto flex h-[87dvh] w-full max-w-7xl flex-col items-center overflow-hidden rounded-[0.33em] bg-white">
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden pt-4 sm:w-7xl sm:flex-row">
          <div className="flex flex-col gap-4 rounded-[0.33em] border border-gray-300 p-3 px-4">
            <Badge className="text-md w-fit" type="destructive">
              Notice
            </Badge>
            <span className="text-gray-700">
              This form is unavailable. <br /> Reason:{" "}
              {formProcess.error.toString().replace("Error: ", "")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!form.formMetadata || form.loading) return <Loader>Loading form...</Loader>;

  const choiceExitTransition = {
    duration: 0.3,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const nextScreenEnterTransition = {
    duration: 0.35,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center overflow-y-scroll [scrollbar-gutter:stable]">
      {showOuterHeader && (
        <div className="w-full flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-2 py-3 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
                {shouldShowSignIntentGate && currentView !== "choice" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setView("choice")}
                    className="mt-0.5 h-8 w-8 shrink-0 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}

                <h3 className="min-w-0 flex-1 text-sm leading-snug font-semibold tracking-tight break-words whitespace-normal sm:text-2xl sm:tracking-normal sm:text-gray-900">
                  {form.formLabel}
                </h3>
              </div>

              <div className="hidden min-w-[210px] flex-col items-end gap-1 md:flex">
                <span className="text-[11px] font-medium text-gray-500">
                  {desktopHeaderTaskTitle}
                  <span className="px-1.5 text-gray-300">•</span>
                  Step {desktopHeaderStepNumber} of {desktopHeaderTotalSteps}
                </span>
                <Progress
                  value={desktopHeaderProgressPercent}
                  className="[&>div]:bg-primary/75 h-[3px] w-[210px] bg-gray-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "mx-auto min-h-0 w-full flex-1 px-0 py-0 transition-[max-width] duration-500 ease-in-out sm:px-6 sm:py-4",
          "max-w-7xl"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {currentView === "choice" ? (
            <motion.div
              key="choice"
              className="h-full"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -32, transition: choiceExitTransition }}
            >
              <SignIntentGate
                onSignSelf={() => setView("form")}
                onDelegate={() => setView("delegate")}
              />
            </motion.div>
          ) : currentView === "delegate" ? (
            <motion.div
              key="delegate"
              className="h-full"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0, transition: nextScreenEnterTransition }}
              exit={{ opacity: 0, y: -16, transition: choiceExitTransition }}
            >
              <DelegateEmailScreen email={delegateEmail} onEmailChange={setDelegateEmail} />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              className="h-full"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0, transition: nextScreenEnterTransition }}
              exit={{ opacity: 0, y: -16, transition: choiceExitTransition }}
            >
              <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[0.33em] border border-gray-300 bg-white">
                {!isMobileLayout && (
                  <div className="border-b border-gray-300 bg-white">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {shouldShowSignIntentGate && currentView !== "choice" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setView("choice")}
                            className="h-7 w-7 shrink-0 p-0 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            aria-label="Back"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <span className="text-primary block truncate text-sm font-semibold tracking-tight">
                          {form.formLabel}
                        </span>
                      </div>

                      <div className="hidden min-w-[210px] flex-col items-end gap-1 md:flex">
                        <span className="text-[11px] font-medium text-gray-500">
                          {desktopHeaderTaskTitle}
                          <span className="px-1.5 text-gray-300">•</span>
                          Step {desktopHeaderStepNumber} of {desktopHeaderTotalSteps}
                        </span>
                        <Progress
                          value={desktopHeaderProgressPercent}
                          className="[&>div]:bg-primary/75 h-[3px] w-[210px] bg-gray-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isMobileLayout && (
                  <div className="border-b border-gray-300 bg-gray-100 px-4 py-2">
                    <div className="truncate text-xs font-medium whitespace-nowrap text-gray-700">
                      Step {mobileStepNumber} of {mobileSteps.length}
                      <span className="px-1 text-gray-400">•</span>
                      {mobileStepTitles[mobileStep]}
                    </div>
                  </div>
                )}

                {isMobileLayout ? (
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <div
                      className={`absolute inset-0 min-h-0 bg-white transition-all duration-500 ease-in-out ${
                        mobileStep === "fields"
                          ? "pointer-events-auto translate-x-0 opacity-100"
                          : getMobileStepHiddenClass("fields")
                      }`}
                    >
                      <div className="flex h-full min-h-0 flex-col">
                        <div
                          className={cn(
                            "absolute inset-0 z-10 min-h-0 bg-white transition-[transform] duration-500 ease-in-out",
                            isMobilePreviewTabActive
                              ? "pointer-events-auto flex flex-col"
                              : "pointer-events-none hidden"
                          )}
                        >
                          {renderMobileFieldsTabs()}
                          <div className="min-h-0 flex-1">
                            {formProcess.latest_document_url ? (
                              <FormPreviewPdfDisplay
                                key="mobile-preview-fields"
                                documentUrl={formProcess.latest_document_url}
                                blocks={previewBlocks}
                                values={previewValues}
                                fieldErrors={formFiller.errors}
                                selectionTick={selectionTick}
                                autoScrollToSelectedField={
                                  !isMobileLayout && selectedFieldSource === "form"
                                }
                                onFieldClick={handlePdfFieldSelect}
                                selectedFieldId={form.selectedPreviewId ?? undefined}
                                scale={0.5}
                                signingParties={signingParties}
                                currentSigningPartyId={formProcess.my_signing_party_id}
                                showOwnership
                                defaultFieldVisibility="mine"
                                prefillMode="live"
                                prefillUser={previewPrefillUser}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center p-4 text-sm text-gray-500">
                                No preview available
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "absolute inset-0 z-20 transition-[transform,opacity] duration-300 ease-in-out",
                            !isMobilePreviewTabActive
                              ? "pointer-events-auto translate-x-0 opacity-100"
                              : mobileStepPaneHiddenClass
                          )}
                        >
                          <div className="flex h-full min-h-0 flex-col">
                            {renderMobileFieldsTabs()}
                            <div className="min-h-0 flex-1">
                              <FormFillerRenderer
                                hideActions
                                onFieldSelect={handleFormFieldSelect}
                                selectionTick={selectionTick}
                                autoScrollToSelectedField={selectedFieldSource === "pdf"}
                              />
                            </div>
                            <div
                              className={cn(
                                "shrink-0 overflow-hidden border-t border-gray-300 bg-gray-50 transition-all duration-300 ease-in-out",
                                isMobilePreviewTabActive
                                  ? "pointer-events-none max-h-0 translate-y-full opacity-0"
                                  : "max-h-24 translate-y-0 opacity-100"
                              )}
                            >
                              <div className="flex items-center gap-2 p-3">
                                <RejectFormButton />
                                <Button
                                  size="lg"
                                  className="flex-1 whitespace-nowrap"
                                  disabled={!canAdvanceFromFields}
                                  onClick={() => {
                                    handleMobileFieldsNext();
                                  }}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`absolute inset-0 min-h-0 bg-white transition-all duration-500 ease-in-out ${
                        mobileStep === "preview-review"
                          ? "pointer-events-auto translate-x-0 opacity-100"
                          : getMobileStepHiddenClass("preview-review")
                      }`}
                    >
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="min-h-0 flex-1">
                          {formProcess.latest_document_url ? (
                            <FormPreviewPdfDisplay
                              key="mobile-preview-review"
                              documentUrl={formProcess.latest_document_url}
                              blocks={previewBlocks}
                              values={previewValues}
                              fieldErrors={formFiller.errors}
                              selectionTick={selectionTick}
                              autoScrollToSelectedField={
                                !isMobileLayout && selectedFieldSource === "form"
                              }
                              onFieldClick={(fieldName) => {
                                handlePdfFieldSelect(fieldName);
                                goToMobileStep("fields");
                              }}
                              selectedFieldId={form.selectedPreviewId ?? undefined}
                              scale={0.5}
                              signingParties={signingParties}
                              currentSigningPartyId={formProcess.my_signing_party_id}
                              showOwnership
                              defaultFieldVisibility="mine"
                              prefillMode="live"
                              prefillUser={previewPrefillUser}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-4 text-sm text-gray-500">
                              No preview available
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 border-t border-gray-300 bg-gray-50 p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-11 w-11 shrink-0"
                              onClick={() => {
                                handleMobileFieldsTabChange("form");
                                goToMobileStep("fields");
                              }}
                              aria-label="Back to form fields"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="lg"
                              className="flex-1 whitespace-nowrap"
                              onClick={() => goToMobileStep("confirm")}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`absolute inset-0 min-h-0 bg-white transition-all duration-500 ease-in-out ${
                        mobileStep === "confirm"
                          ? "pointer-events-auto translate-x-0 opacity-100"
                          : getMobileStepHiddenClass("confirm")
                      }`}
                    >
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                          <div className="flex flex-col items-start gap-4">
                            <LucideClipboardCheck className="-ml-2 h-16 min-h-16 w-16 opacity-30" />
                            <span className="font-semibold text-gray-700">
                              Please check if all your inputs are correct
                            </span>
                            <label className="flex cursor-pointer items-center gap-3 rounded-[0.33em] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                              <Checkbox
                                checked={hasConfirmedDetails}
                                className={cn(
                                  "h-5 w-5 rounded-[0.33em] border",
                                  hasConfirmedDetails
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-gray-300 bg-white"
                                )}
                                onCheckedChange={(checked) =>
                                  setHasConfirmedDetails(checked === true)
                                }
                              />
                              <span>I confirm all the details are correct</span>
                            </label>
                          </div>
                        </div>
                        <div className="shrink-0 border-t border-gray-300 bg-gray-50 p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-11 w-11 shrink-0"
                              onClick={() => goToMobileStep("preview-review")}
                              aria-label="Back to preview review"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <SubmitFormButton
                              submitDisabled={!hasConfirmedDetails}
                              requireSignAgreement={false}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] transition-[grid-template-columns] duration-500 ease-in-out">
                    <div className="min-h-0 rounded-r-none border-r border-gray-300 bg-white transition-[transform] duration-500 ease-in-out">
                      {formProcess.latest_document_url ? (
                        <div className="h-full [&>div]:rounded-none [&>div]:border-0">
                          <FormPreviewPdfDisplay
                            documentUrl={formProcess.latest_document_url}
                            blocks={previewBlocks}
                            values={previewValues}
                            fieldErrors={formFiller.errors}
                            selectionTick={selectionTick}
                            autoScrollToSelectedField={selectedFieldSource === "form"}
                            onFieldClick={handlePdfFieldSelect}
                            selectedFieldId={form.selectedPreviewId ?? undefined}
                            scale={0.7}
                            signingParties={signingParties}
                            currentSigningPartyId={formProcess.my_signing_party_id}
                            showOwnership
                            defaultFieldVisibility="mine"
                            prefillMode="live"
                            prefillUser={previewPrefillUser}
                          />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-sm text-gray-500">
                          No preview available
                        </div>
                      )}
                    </div>

                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white transition-[opacity,transform] duration-500 ease-in-out">
                      <div
                        className={cn(
                          "absolute inset-0 min-h-0 bg-white transition-all duration-500 ease-in-out",
                          desktopStep === "fields"
                            ? "pointer-events-auto translate-x-0 opacity-100"
                            : "pointer-events-none -translate-x-6 opacity-0"
                        )}
                      >
                        <div className="flex h-full min-h-0 flex-1 flex-col pt-4 sm:pt-8">
                          <div className="min-h-0 flex-1">
                            <FormFillerRenderer
                              hideActions
                              onFieldSelect={handleFormFieldSelect}
                              selectionTick={selectionTick}
                              autoScrollToSelectedField={selectedFieldSource === "pdf"}
                            />
                          </div>
                          <div className="shrink-0 border-t border-gray-300 bg-gray-50 p-3">
                            <div className="flex items-center gap-2">
                              <RejectFormButton />
                              <Button
                                size="lg"
                                className="flex-1 whitespace-nowrap"
                                disabled={!canAdvanceFromFields}
                                onClick={() => {
                                  if (!validateFields()) return;

                                  setDesktopStep("confirm");
                                }}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "absolute inset-0 min-h-0 bg-white transition-all duration-500 ease-in-out",
                          desktopStep === "confirm"
                            ? "pointer-events-auto translate-x-0 opacity-100"
                            : "pointer-events-none translate-x-6 opacity-0"
                        )}
                      >
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            <div className="flex flex-col items-start gap-4">
                              <LucideClipboardCheck className="-ml-2 h-16 min-h-16 w-16 opacity-30" />
                              <span className="font-semibold text-gray-700">
                                Please check if all your inputs are correct
                              </span>
                              <label className="flex cursor-pointer items-center gap-3 rounded-[0.33em] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                                <Checkbox
                                  checked={hasConfirmedDetails}
                                  className={cn(
                                    "h-5 w-5 rounded-[0.33em] border",
                                    hasConfirmedDetails
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-gray-300 bg-white"
                                  )}
                                  onCheckedChange={(checked) =>
                                    setHasConfirmedDetails(checked === true)
                                  }
                                />
                                <span>I confirm all the details are correct</span>
                              </label>
                            </div>
                          </div>
                          <div className="shrink-0 border-t border-gray-300 bg-gray-50 p-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-11 w-11 shrink-0"
                                onClick={() => setDesktopStep("fields")}
                                aria-label="Back to form fields"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </Button>
                              <SubmitFormButton
                                submitDisabled={!hasConfirmedDetails}
                                requireSignAgreement={false}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Page;
