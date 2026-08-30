import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { useFormProcess } from "./form-process.ctx";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";

export interface SigningPartyMapParty {
  _id: string;
  order: number;
  signed?: boolean;
  signatory_title?: string;
  signatory_email?: string;
}

interface SigningPartyTimelineProps {
  signingParties?: SigningPartyMapParty[];
  currentSigningPartyId?: string;
  isCancelled?: boolean;
}

export const SigningPartyTimeline = ({
  signingParties,
  currentSigningPartyId: suppliedCurrentSigningPartyId,
  isCancelled = false,
}: SigningPartyTimelineProps) => {
  const formProcess = useFormProcess();

  if (!signingParties || signingParties.length === 0) {
    return null;
  }

  const orderedSigningParties = signingParties.toSorted((a, b) => a.order - b.order);
  const currentSigningPartyId =
    suppliedCurrentSigningPartyId ??
    formProcess.my_signing_party_id ??
    orderedSigningParties.find((party) => !party.signed)?._id;

  return (
    <Timeline>
      {orderedSigningParties.map((party, index) => {
        const isCurrent = !isCancelled && !party.signed && party._id === currentSigningPartyId;
        const title = party.signatory_title?.trim() || `Signing party ${party.order}`;

        return (
          <TimelineItem
            key={party._id}
            number={party.signed ? -1 : index + 1}
            isMe={party._id === formProcess.my_signing_party_id}
            title={
              isCurrent ? (
                <div className="text-sm leading-5 break-words sm:text-base">
                  <AnimatedShinyText>{title}</AnimatedShinyText>
                </div>
              ) : (
                <div
                  className={`text-sm leading-5 break-words sm:text-base ${party.signed ? "text-emerald-600" : "text-gray-900"}`}
                >
                  {title}
                </div>
              )
            }
            subtitle={
              party.signatory_email && (
                <div className="text-xs text-gray-500">
                  {isCurrent ? (
                    <AnimatedShinyText>{party.signatory_email}</AnimatedShinyText>
                  ) : (
                    party.signatory_email
                  )}
                </div>
              )
            }
            isLast={index === orderedSigningParties.length - 1}
          />
        );
      })}
    </Timeline>
  );
};
