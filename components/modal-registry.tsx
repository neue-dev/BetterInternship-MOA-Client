import { useModal } from "@/app/providers/modal-provider";
import {
  ClientBlock,
  ClientField,
  ClientPhantomField,
  FormValues,
  IFormSigningParty,
} from "@betterinternship/core/forms";
import { IFormFiller } from "./docs/forms/form-filler.ctx";
import { SpecifySigningPartiesModal } from "./modals/SpecifySigningPartyModal";
import { FormContinuationSuccessModal } from "./modals/FormContinuationSuccessModal";
import { FormRejectionPromptModal } from "./modals/FormRejectionPromptModal";
import { CompleteProfileModal } from "./docs/modals/CompleteProfileModal";
import { ISignatoryFormSettings } from "@/app/docs/auth/provider/form-settings.ctx";
import { SetupFormSettings } from "./modals/SetupFormSettings";
import { CancelledFormDetailsModal } from "./modals/CancelledFormDetailsModal";
import { SigningMapModal } from "./modals/SigningMapModal";
import { SigningPartyMapParty } from "./docs/forms/SignignPartyTimeline";
import { DuplicateSignatoryWarningModal } from "./modals/DuplicateSignatoryWarningModal";

/**
 * Simplifies modal config since we usually reuse each of these modal stuffs.
 *
 * @returns
 */
export const useModalRegistry = () => {
  const { openModal: open, closeModal: close } = useModal();

  const modalRegistry = {
    formSettingsSetup: {
      open: (
        fields: (ClientField<[any]> | ClientPhantomField<[any]>)[],
        formFiller: IFormFiller,
        handleSubmit: (finalValues: FormValues, settings: ISignatoryFormSettings) => Promise<any>,
        handleUpdateAutofill: (finalValues: FormValues) => Promise<any>,
        formSettings: ISignatoryFormSettings,
        autofillValues?: FormValues
      ) =>
        open(
          "form-settings-setup",
          <SetupFormSettings
            fields={fields}
            formFiller={formFiller}
            formSettings={formSettings}
            autofillValues={autofillValues}
            handleSubmit={handleSubmit}
            handleUpdateAutofill={handleUpdateAutofill}
            close={() => close("form-settings-setup")}
          />,
          {
            title: <div className="px-5 py-1 text-3xl font-bold tracking-tight">Submit Form</div>,
            closeOnEsc: false,
            allowBackdropClick: false,
            hasClose: false,
            showHeaderDivider: true,
          }
        ),
      close: () => close("form-settings-setup"),
    },

    // Email confirmation modal
    specifySigningParties: {
      open: (
        fields: (ClientField<[any]> | ClientPhantomField<[any]>)[],
        formFiller: IFormFiller,
        signingPartyBlocks: ClientBlock<[any]>[],
        handleSubmit: (finalValues: FormValues, settings: ISignatoryFormSettings) => Promise<any>,
        handleUpdateAutofill: (finalValues: FormValues) => Promise<any>,
        formSettings: ISignatoryFormSettings,
        autofillValues?: FormValues,
        signingParties?: IFormSigningParty[]
      ) =>
        open(
          "specify-signing-parties",
          <SpecifySigningPartiesModal
            fields={fields}
            formFiller={formFiller}
            signingPartyBlocks={signingPartyBlocks}
            formSettings={formSettings}
            autofillValues={autofillValues}
            handleSubmit={handleSubmit}
            handleUpdateAutofill={handleUpdateAutofill}
            close={() => close("specify-signing-parties")}
            signingParties={signingParties}
          />,
          {
            title: "Next Signing Parties",
            closeOnEsc: false,
            allowBackdropClick: false,
            hasClose: false,
            showHeaderDivider: true,
          }
        ),
      close: () => close("specify-signing-parties"),
    },

    // Appears when a form has successfully been submitted
    formContinuationSuccess: {
      open: () =>
        open("form-continuation-success", <FormContinuationSuccessModal />, {
          hasClose: false,
          allowBackdropClick: false,
        }),
      close: () => close("form-continuation-success"),
    },

    formRejectionPrompt: {
      open: (formProcessId: string) =>
        open("form-rejection-prompt", <FormRejectionPromptModal formProcessId={formProcessId} />, {
          title: "Reject to Fill This Form",
        }),
      close: () => close("form-rejection-prompt"),
    },

    cancelledFormDetails: {
      open: (rejectionReason?: string | null) =>
        open(
          "cancelled-form-details",
          <CancelledFormDetailsModal rejectionReason={rejectionReason} />,
          {
            title: "Cancelled Form Details",
            hasClose: false,
          }
        ),
      close: () => close("cancelled-form-details"),
    },

    signingMap: {
      open: (signingParties: SigningPartyMapParty[], currentSigningPartyId?: string) =>
        open(
          "signing-map",
          <SigningMapModal
            signingParties={signingParties}
            currentSigningPartyId={currentSigningPartyId}
          />,
          {
            title: "Signing progress",
            panelClassName: "sm:!h-auto sm:!w-auto sm:!max-w-2xl",
            contentClassName: "max-h-[calc(var(--vh,1vh)*100-4rem)] overflow-auto px-6 pb-6 pt-2",
          }
        ),
      close: () => close("signing-map"),
    },

    duplicateSignatoryWarning: {
      open: (previousRoles: string[], currentRole: string, onConfirm: () => void) =>
        open(
          "duplicate-signatory-warning",
          <DuplicateSignatoryWarningModal
            previousRoles={previousRoles}
            currentRole={currentRole}
            onCancel={() => close("duplicate-signatory-warning")}
            onConfirm={() => {
              close("duplicate-signatory-warning");
              onConfirm();
            }}
          />,
          {
            panelClassName: "sm:w-full sm:max-w-xl",
            hasClose: false,
          }
        ),
      close: () => close("duplicate-signatory-warning"),
    },

    // Complete profile modal
    completeProfile: {
      open: () =>
        open("complete-profile", <CompleteProfileModal close={() => close("complete-profile")} />, {
          hasClose: false,
          allowBackdropClick: false,
        }),
      close: () => close("complete-profile"),
    },
  };

  return modalRegistry;
};

export default useModalRegistry;
