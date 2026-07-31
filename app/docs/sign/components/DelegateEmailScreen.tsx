"use client";

import { useCallback, useState } from "react";
import { useModal } from "@/app/providers/modal-provider";
import { useFormProcess } from "@/components/docs/forms/form-process.ctx";
import { FormContinuationSuccessModal } from "@/components/modals/FormContinuationSuccessModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formsControllerAlterRecipient } from "../../../api/app/api/endpoints/forms/forms";
import { useFormRendererContext } from "@/components/docs/forms/form-renderer.ctx";

type DelegateEmailScreenProps = {
  email: string;
  onEmailChange: (value: string) => void;
};

export function DelegateEmailScreen({ email, onEmailChange }: DelegateEmailScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { openModal, closeModal } = useModal();
  const form = useFormRendererContext();
  const formProcess = useFormProcess();
  const signingParties = form.formMetadata.getSigningParties();
  const signingPartyId = formProcess.my_signing_party_id;
  const signingParty = signingParties.find((signingParty) => signingParty._id === signingPartyId);

  const handleSubmit = useCallback(async () => {
    const recipientEmail = email.trim();
    const mySigningPartyId = formProcess.my_signing_party_id;

    if (!recipientEmail) {
      toast.error("Enter an email address first.");
      return;
    }

    if (!mySigningPartyId) {
      toast.error("Broken URL. Check that you used the correct link.");
      return;
    }

    try {
      setIsSubmitting(true);
      await formsControllerAlterRecipient({
        formProcessId: formProcess.id,
        supposedSigningPartyId: mySigningPartyId,
        recipientEmail,
      });
      openModal(
        "delegate-recipient-success",
        <FormContinuationSuccessModal
          title="Request sent successfully"
          description="The new recipient has been notified. You can head back to your forms now."
          buttonLabel="View my forms"
          onClose={() => closeModal("delegate-recipient-success")}
        />,
        {
          hasClose: false,
          allowBackdropClick: false,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace("Error: ", "") : "Failed to send request.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [closeModal, email, formProcess, openModal]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-xl space-y-4 rounded-[0.33em] border border-gray-300 p-8">
        <p className="flex flex-col text-left text-base font-medium text-gray-700 sm:text-lg">
          <p className="font-thin">Enter the email address of the actual</p>
          <span className="text-primary font-bold">{signingParty?.signatory_title}</span>
          <p className="font-thin">who should sign this document.</p>
        </p>
        <Input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="name@example.com"
          className="h-12 border-gray-300 text-base"
        />
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? "Forwarding..." : "Forward"}
        </Button>
      </div>
    </div>
  );
}
