import {
  SigningPartyTimeline,
  type SigningPartyMapParty,
} from "@/components/docs/forms/SignignPartyTimeline";

export const SigningMapModal = ({
  signingParties,
  currentSigningPartyId,
}: {
  signingParties: SigningPartyMapParty[];
  currentSigningPartyId?: string;
}) => (
  <SigningPartyTimeline
    signingParties={signingParties}
    currentSigningPartyId={currentSigningPartyId}
  />
);
