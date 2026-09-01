"use client";

import { useFormProcess } from "@/components/docs/forms/form-process.ctx";
import { useFormRendererContext } from "@/components/docs/forms/form-renderer.ctx";
import { Button } from "@/components/ui/button";
import { useSignatoryProfile } from "@/app/docs/auth/provider/signatory.ctx";
import useModalRegistry from "@/components/modal-registry";

type SignIntentGateProps = {
  onSignSelf: () => void;
  onDelegate: () => void;
};

export function SignIntentGate({ onSignSelf, onDelegate }: SignIntentGateProps) {
  const form = useFormRendererContext();
  const formProcess = useFormProcess();
  const profile = useSignatoryProfile();
  const modalRegistry = useModalRegistry();
  const displayInformation = formProcess.display_information as Record<string, string>;
  const documentName = formProcess.form_label;
  const studentName = displayInformation?.["student.full-name:default"];
  const signingParties = form.formMetadata.getSigningParties();
  const signingPartyId = formProcess.my_signing_party_id;
  const signingParty = signingParties.find((signingParty) => signingParty._id === signingPartyId);
  const previousRoles = (formProcess.signing_parties ?? [])
    .filter(
      (party) =>
        party._id !== signingPartyId &&
        party.signed &&
        party.signatory_email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
    )
    .map((party) => party.signatory_title?.trim() || `Signing party ${party.order}`);
  const currentRole = signingParty?.signatory_title?.trim() || "this role";

  const handleSignSelf = () => {
    if (previousRoles.length) {
      modalRegistry.duplicateSignatoryWarning.open(previousRoles, currentRole, onSignSelf);
      return;
    }

    onSignSelf();
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl items-start justify-center px-4 pt-4 pb-6 sm:h-full sm:items-center sm:px-6 sm:py-10">
      <div className="w-full">
        <p className="mx-auto max-w-5xl text-left text-base leading-relaxed font-medium text-gray-700 sm:text-lg">
          <span className="text-primary font-bold">{studentName}</span>{" "}
          <span className="font-thin">has requested you to fill out their</span>{" "}
          <span className="text-primary font-bold">{documentName}</span>{" "}
          <span className="font-thin">as</span>{" "}
          <span className="text-primary font-bold">{signingParty?.signatory_title}</span>.
        </p>

        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="group h-auto min-h-28 w-full flex-row items-stretch gap-0 overflow-hidden p-0 text-base whitespace-normal sm:min-h-56 sm:flex-col"
            onClick={handleSignSelf}
          >
            <div className="flex w-28 shrink-0 items-center justify-center bg-gray-100 px-4 py-4 transition-colors group-hover:bg-gray-200 sm:min-h-36 sm:w-full sm:flex-1 sm:px-6 sm:py-8">
              <div className="bg-primary rounded-full p-4 opacity-85 sm:p-6">
                <img
                  src="/assets/sign-document.png"
                  alt=""
                  width={96}
                  height={96}
                  className="h-10 w-10 translate-y-[-1px] object-contain opacity-80 invert sm:h-20 sm:w-20"
                />
              </div>
            </div>
            <div className="flex min-h-0 w-full flex-col justify-center px-4 py-3 text-left sm:border-t sm:px-6 sm:py-5">
              <span className="text-sm font-semibold sm:text-base">I am the</span>
              <span className="text-sm font-thin sm:text-base">
                {signingParty?.signatory_title}
              </span>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="group h-auto min-h-28 w-full flex-row items-stretch gap-0 overflow-hidden p-0 text-base whitespace-normal sm:min-h-56 sm:flex-col"
            onClick={onDelegate}
          >
            <div className="flex w-28 shrink-0 items-center justify-center bg-gray-100 px-4 py-4 transition-colors group-hover:bg-gray-200 sm:min-h-36 sm:w-full sm:flex-1 sm:px-6 sm:py-8">
              <div className="bg-primary rounded-full p-4 opacity-85 sm:p-6">
                <img
                  src="/assets/forward-document.png"
                  alt=""
                  width={96}
                  height={96}
                  className="h-10 w-10 translate-x-1 translate-y-0.5 object-contain opacity-80 invert sm:h-20 sm:w-20"
                />
              </div>
            </div>
            <div className="flex min-h-0 w-full flex-col justify-center px-4 py-3 text-left sm:border-t sm:px-6 sm:py-5">
              <span className="text-sm font-semibold sm:text-base">Forward this to the actual</span>
              <span className="text-sm font-thin sm:text-base">
                {signingParty?.signatory_title}
              </span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
