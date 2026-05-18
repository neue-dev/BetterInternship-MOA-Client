/**
 * @ Author: BetterInternship
 * @ Create Time: 2025-12-30 07:06:04
 * @ Modified time: 2026-01-02 20:27:46
 * @ Description:
 *
 * Makes it easier to manage signatory account state across files.
 * // ! MERGE THIS WITH THE FORM FILLER CONTEXT PROBABLY
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ISignContext {
  hasAgreed?: boolean;
  setRequiredSignatures: (requiredSignatureFieldIds: string[]) => void;
  setHasAgreedForSignature: (
    signatureFieldId: string,
    signatureValue: string,
    hasAgreed: boolean
  ) => void;
}

type ISignatureAgreementDict = Record<string, { hasAgreed?: boolean; signatureValue?: string }>;

const SignContext = createContext({} as ISignContext);

export const useSignContext = () => useContext(SignContext);

export const SignContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [signatureAgreementDict, setSignatureAgreementDict] = useState<ISignatureAgreementDict>({});

  // Should be called to init this context
  const setRequiredSignatures = useCallback((requiredSignatureFieldIds: string[]) => {
    setSignatureAgreementDict((current) => {
      const requiredSignatures: ISignatureAgreementDict = {};
      for (const requiredSignature of requiredSignatureFieldIds) {
        // Preserve existing agreement data if it exists
        requiredSignatures[requiredSignature] = current[requiredSignature] || {};
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(requiredSignatures);
      const isSame =
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === requiredSignatures[key]);

      return isSame ? current : requiredSignatures;
    });
  }, []);

  // Checks whether or not all the needed signatures are good
  const hasAgreed = useMemo(
    () =>
      Object.values(signatureAgreementDict).every(
        (signatureAgreement) =>
          !!signatureAgreement.hasAgreed && !!signatureAgreement.signatureValue?.trim()
      ),
    [signatureAgreementDict]
  );

  // Update the dict
  const setHasAgreedForSignature = useCallback(
    (signatureFieldId: string, signatureValue: string, hasAgreed: boolean) => {
      setSignatureAgreementDict((current) => {
        const existing = current[signatureFieldId];
        if (existing?.hasAgreed === hasAgreed && existing?.signatureValue === signatureValue) {
          return current;
        }

        return {
          ...current,
          [signatureFieldId]: { hasAgreed, signatureValue },
        };
      });
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      hasAgreed,
      setHasAgreedForSignature,
      setRequiredSignatures,
    }),
    [hasAgreed, setHasAgreedForSignature, setRequiredSignatures]
  );

  return (
    <SignContext.Provider value={contextValue}>{children}</SignContext.Provider>
  );
};
